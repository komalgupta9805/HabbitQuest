"""Local-first Little Wins API. Dates are local calendar dates and rewards are persisted server-side."""
from datetime import date, datetime, timedelta, timezone
from hashlib import sha256
import re
from secrets import token_urlsafe
from typing import Generator
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError, available_timezones
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint, create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, relationship, sessionmaker
from .config import ACHIEVEMENT_XP, COMPLETION_XP, CORS_ORIGINS, CORS_ORIGIN_REGEX, DAILY_BONUS_XP, DATABASE_URL
from .security import hash_password, issue_token, token_is_valid, verify_password

HABIT_COLORS = ("#2E9E6F", "#E58A2B", "#735DD0", "#3182CE", "#159A9C", "#D85B7B", "#8A6D3B", "#567C3E", "#C45A3C", "#5B6FC0", "#B56BA7", "#2F8F9D", "#C98B2E", "#6A8E3A", "#9B5DE5", "#008C72", "#C65D7B", "#4A7C9B", "#A66A48", "#6B7F33")
HABIT_ICONS = {"water","exercise","walk","book","study","code","meditate","sleep","nutrition","health","target","sparkles"}
LEGACY_HABIT_ICONS = {"✦","⌘","↗","◎","◆"}
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine); Base = declarative_base()
def utc_now(): return datetime.now(timezone.utc).replace(tzinfo=None)
class User(Base):
    __tablename__="users"; id=Column(Integer,primary_key=True); name=Column(String(80),nullable=False); email=Column(String(160),unique=True,nullable=False,index=True); password_hash=Column(String(128),nullable=False); xp=Column(Integer,default=0,nullable=False); leaderboard_opt_in=Column(Integer,default=0,nullable=False); token=Column(String(96),unique=True,nullable=False); token_expires_at=Column(DateTime,nullable=True); timezone=Column(String(80),default="",nullable=False); created_at=Column(DateTime,default=utc_now,nullable=False); updated_at=Column(DateTime,default=utc_now,onupdate=utc_now,nullable=False)
class Habit(Base):
    __tablename__="habits"; id=Column(Integer,primary_key=True); user_id=Column(Integer,ForeignKey("users.id"),nullable=False,index=True); name=Column(String(80),nullable=False); description=Column(String(240),default="",nullable=False); category=Column(String(40),default="Personal",nullable=False); schedule=Column(String(30),default="daily",nullable=False); created_on=Column(Date,default=date.today,nullable=False); end_on=Column(Date,nullable=True); active=Column(Integer,default=1,nullable=False); archived_on=Column(Date,nullable=True); icon=Column(String(12),default="sparkles",nullable=False); color=Column(String(7),default=HABIT_COLORS[0],nullable=False); target_days=Column(Integer,default=0,nullable=False); target_text=Column(String(120),default="",nullable=False); daily_target=Column(Float,nullable=True); target_unit=Column(String(30),default="",nullable=False); reminder_time=Column(String(5),default="",nullable=False); is_demo=Column(Integer,default=0,nullable=False); created_at=Column(DateTime,default=utc_now,nullable=False); updated_at=Column(DateTime,default=utc_now,onupdate=utc_now,nullable=False)
    archive_periods=relationship("ArchivePeriod",cascade="all, delete-orphan")
    schedule_periods=relationship("SchedulePeriod",cascade="all, delete-orphan",order_by="SchedulePeriod.started_on")
class ArchivePeriod(Base):
    __tablename__="archive_periods"; id=Column(Integer,primary_key=True); habit_id=Column(Integer,ForeignKey("habits.id"),nullable=False,index=True); started_on=Column(Date,nullable=False); ended_on=Column(Date,nullable=True)
class SchedulePeriod(Base):
    __tablename__="schedule_periods"; id=Column(Integer,primary_key=True); habit_id=Column(Integer,ForeignKey("habits.id"),nullable=False,index=True); started_on=Column(Date,nullable=False); ended_on=Column(Date,nullable=True); schedule=Column(String(30),nullable=False)
class Completion(Base):
    __tablename__="completions"; id=Column(Integer,primary_key=True); habit_id=Column(Integer,ForeignKey("habits.id"),nullable=False,index=True); user_id=Column(Integer,ForeignKey("users.id"),nullable=True,index=True); completed_on=Column(Date,nullable=False,index=True); status=Column(String(16),default="complete",nullable=False); recorded_value=Column(Float,nullable=True); note=Column(String(300),default="",nullable=False); created_at=Column(DateTime,default=utc_now,nullable=False); updated_at=Column(DateTime,default=utc_now,onupdate=utc_now,nullable=False); __table_args__=(UniqueConstraint("habit_id","completed_on",name="unique_daily_completion"),)
class RewardClaim(Base):
    __tablename__="reward_claims"; id=Column(Integer,primary_key=True); user_id=Column(Integer,ForeignKey("users.id"),nullable=False); reward_key=Column(String(100),nullable=False); amount=Column(Integer,nullable=False); __table_args__=(UniqueConstraint("user_id","reward_key",name="unique_reward_claim"),)
class Achievement(Base):
    __tablename__="achievements"; id=Column(Integer,primary_key=True); user_id=Column(Integer,ForeignKey("users.id"),nullable=False); code=Column(String(40),nullable=False); unlocked_on=Column(Date,default=date.today,nullable=False); __table_args__=(UniqueConstraint("user_id","code",name="unique_achievement"),)
class XPTransaction(Base):
    __tablename__="xp_transactions"; id=Column(Integer,primary_key=True); user_id=Column(Integer,ForeignKey("users.id"),nullable=False,index=True); source=Column(String(40),nullable=False); amount=Column(Integer,nullable=False); idempotency_key=Column(String(180),nullable=False); related_id=Column(String(80),default="",nullable=False); event_date=Column(Date,nullable=True,index=True); created_at=Column(DateTime,default=utc_now,nullable=False); __table_args__=(UniqueConstraint("user_id","idempotency_key",name="unique_xp_event"),)
class GoalHabit(Base):
    __tablename__="goal_habits"; goal_id=Column(Integer,ForeignKey("goals.id",ondelete="CASCADE"),primary_key=True); habit_id=Column(Integer,ForeignKey("habits.id",ondelete="CASCADE"),primary_key=True)
class Goal(Base):
    __tablename__="goals"; id=Column(Integer,primary_key=True); user_id=Column(Integer,ForeignKey("users.id"),nullable=False,index=True); title=Column(String(100),nullable=False); description=Column(String(300),default="",nullable=False); target_count=Column(Integer,nullable=False); start_on=Column(Date,nullable=False); end_on=Column(Date,nullable=False); status=Column(String(16),default="active",nullable=False); created_at=Column(DateTime,default=utc_now,nullable=False); updated_at=Column(DateTime,default=utc_now,onupdate=utc_now,nullable=False); habits=relationship("Habit",secondary="goal_habits")
class Invitation(Base):
    __tablename__="invitations"; id=Column(Integer,primary_key=True); inviter_user_id=Column(Integer,ForeignKey("users.id"),nullable=False,index=True); token_hash=Column(String(64),unique=True,nullable=False,index=True); expires_at=Column(DateTime,nullable=False); revoked_at=Column(DateTime,nullable=True); uses=Column(Integer,default=0,nullable=False); created_at=Column(DateTime,default=utc_now,nullable=False)
Base.metadata.create_all(engine)
# Lightweight backward-compatible migration for local project databases.
_columns={c["name"] for c in inspect(engine).get_columns("habits")}
for _name,_sql in {"active":"INTEGER NOT NULL DEFAULT 1","archived_on":"DATE","end_on":"DATE","icon":"VARCHAR(12) NOT NULL DEFAULT '✦'","color":"VARCHAR(7)","target_days":"INTEGER NOT NULL DEFAULT 0","target_text":"VARCHAR(120) NOT NULL DEFAULT ''","daily_target":"FLOAT","target_unit":"VARCHAR(30) NOT NULL DEFAULT ''","reminder_time":"VARCHAR(5) NOT NULL DEFAULT ''","is_demo":"INTEGER NOT NULL DEFAULT 0","created_at":"DATETIME","updated_at":"DATETIME"}.items():
    if _name not in _columns:
        with engine.begin() as connection: connection.execute(text(f"ALTER TABLE habits ADD COLUMN {_name} {_sql}"))
with engine.begin() as connection:
    connection.execute(text("UPDATE habits SET archived_on = CURRENT_DATE WHERE active = 0 AND archived_on IS NULL"))
with SessionLocal() as _migration_session:
    for _habit in _migration_session.query(Habit).filter((Habit.color.is_(None)) | (Habit.color=="")).all():
        _habit.color=HABIT_COLORS[(_habit.id-1)%len(HABIT_COLORS)]
    _migration_session.commit()
def _add_columns(table, definitions):
    existing={c["name"] for c in inspect(engine).get_columns(table)}
    for name,sql in definitions.items():
        if name not in existing:
            with engine.begin() as connection: connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql}"))
_add_columns("users",{"token_expires_at":"DATETIME","timezone":"VARCHAR(80) NOT NULL DEFAULT ''","leaderboard_opt_in":"INTEGER NOT NULL DEFAULT 0","created_at":"DATETIME","updated_at":"DATETIME"})
_add_columns("completions",{"user_id":"INTEGER REFERENCES users(id)","status":"VARCHAR(16) NOT NULL DEFAULT 'complete'","recorded_value":"FLOAT","note":"VARCHAR(300) NOT NULL DEFAULT ''","created_at":"DATETIME","updated_at":"DATETIME"})
_add_columns("xp_transactions",{"event_date":"DATE"})
with engine.begin() as connection:
    connection.execute(text("UPDATE completions SET user_id=(SELECT user_id FROM habits WHERE habits.id=completions.habit_id) WHERE user_id IS NULL"))
    connection.execute(text("UPDATE xp_transactions SET event_date=DATE(created_at) WHERE event_date IS NULL"))
app=FastAPI(title="Little Wins API",version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Time-Zone"],
)
class Credentials(BaseModel): name:str=Field("",max_length=80); email:str=Field(min_length=3,max_length=160); password:str=Field(min_length=6,max_length=100); invite_token:str=Field("",max_length=200)
class HabitInput(BaseModel):
    name:str=Field(min_length=1,max_length=80); description:str=Field("",max_length=240); category:str=Field("Personal",max_length=40); schedule:str="daily"; icon:str=Field("sparkles",max_length=12); color:str|None=None; start_date:date|None=None; end_date:date|None=None; target_days:int=Field(0,ge=0,le=3650); target_text:str=Field("",max_length=120); daily_target:float|None=Field(None,gt=0,le=1_000_000); target_unit:str=Field("",max_length=30); reminder_time:str=Field("",max_length=5)
    @field_validator("name", "category")
    @classmethod
    def not_blank(cls,value):
        if not value.strip(): raise ValueError("This field cannot be blank.")
        return value.strip()
    @field_validator("color")
    @classmethod
    def valid_color(cls,value):
        if value is not None and not re.fullmatch(r"#[0-9A-Fa-f]{6}",value): raise ValueError("Color must be a six-digit hex color.")
        return value.upper() if value else None
    @field_validator("icon")
    @classmethod
    def valid_icon(cls,value):
        value=value.strip() or "sparkles"
        if value not in HABIT_ICONS and value not in LEGACY_HABIT_ICONS: raise ValueError("Choose an icon from the supported habit icon set.")
        return value
class CompletionInput(BaseModel): completed_on:date|None=None; recorded_value:float|None=Field(None,ge=0,le=1_000_000); note:str=Field("",max_length=300)
class GoalInput(BaseModel):
    title:str=Field(min_length=1,max_length=100); description:str=Field("",max_length=300); target_count:int=Field(ge=1,le=10000); start_on:date; end_on:date; habit_ids:list[int]=Field(default_factory=list,max_length=50)
    @field_validator("title")
    @classmethod
    def goal_title(cls,value):
        if not value.strip(): raise ValueError("Goal title cannot be blank.")
        return value.strip()
class ProgressInput(BaseModel): completed_on:date|None=None; recorded_value:float=Field(ge=0,le=1_000_000); note:str=Field("",max_length=300)
class LeaderboardInput(BaseModel): enabled:bool
def db()->Generator[Session,None,None]:
    s=SessionLocal()
    try: yield s
    finally: s.close()
def auth(authorization:str=Header(""),s:Session=Depends(db)):
    u=s.query(User).filter_by(token=authorization.removeprefix("Bearer ")).first()
    if not u or not token_is_valid(u.token_expires_at): raise HTTPException(401,"Please sign in first.",headers={"WWW-Authenticate":"Bearer"})
    return u
def client_today(x_time_zone:str=Header("")):
    zone_name=x_time_zone.strip()
    if not zone_name: return date.today()
    try: return datetime.now(ZoneInfo(zone_name)).date()
    except ZoneInfoNotFoundError:
        if not available_timezones():
            raise HTTPException(503,"Server time zone data is unavailable. Install the backend requirements and restart the API.")
        raise HTTPException(422,"X-Time-Zone must be a valid IANA time zone, such as Asia/Kolkata.")
    except ValueError:
        raise HTTPException(422,"X-Time-Zone must be a valid IANA time zone, such as Asia/Kolkata.")
def level(xp):
    n=xp//100+1; within=xp%100
    return {"level":n,"xp":xp,"current_level_xp":(n-1)*100,"next_level_xp":n*100,"xp_into_level":within,"xp_for_next_level":100,"xp_to_next_level":100-within,"level_progress":within}
def valid_schedule(x): return x=="daily" or bool(x) and len(x.split(","))==len(set(x.split(","))) and all(part in "0123456" and len(part)==1 for part in x.split(","))
def is_scheduled(h,d):
    schedule=next((p.schedule for p in h.schedule_periods if p.started_on<=d and (p.ended_on is None or d<p.ended_on)),h.schedule)
    return schedule=="daily" or str(d.weekday()) in schedule.split(",")
def occurs(h,d):
    if d<h.created_on or (h.end_on and d>h.end_on) or not is_scheduled(h,d): return False
    if any(p.started_on<=d and (p.ended_on is None or d<p.ended_on) for p in h.archive_periods): return False
    return bool(h.active or h.archived_on is None or d<h.archived_on)
def habits(s,u): return s.query(Habit).filter_by(user_id=u.id).order_by(Habit.id.desc()).all()
def owned(hid,u,s):
    h=s.query(Habit).filter_by(id=hid,user_id=u.id).first()
    if not h: raise HTTPException(404,"Habit not found.")
    return h
def dates(s,h): return {c.completed_on for c in s.query(Completion).filter_by(habit_id=h.id,status="complete")}
def streak(s,h,today=None):
    today=today or date.today(); done=dates(s,h); cursor=today
    while cursor>=h.created_on and not occurs(h,cursor): cursor-=timedelta(days=1)
    # The current local day is still an open opportunity. It neither counts nor
    # breaks the persisted run until it is completed or becomes a past date.
    if cursor==today and cursor not in done:
        cursor-=timedelta(days=1)
        while cursor>=h.created_on and not occurs(h,cursor): cursor-=timedelta(days=1)
    current=0
    while cursor>=h.created_on and cursor in done:
        current+=1; cursor-=timedelta(days=1)
        while cursor>=h.created_on and not occurs(h,cursor): cursor-=timedelta(days=1)
    longest=run=0; cursor=h.created_on
    while cursor<=today:
        if occurs(h,cursor): run=run+1 if cursor in done else 0; longest=max(longest,run)
        cursor+=timedelta(days=1)
    return {"current":current,"longest":longest}
def habit_out(s,h,today=None):
    today=today or date.today()
    done=len(dates(s,h)); end=h.created_on+timedelta(days=h.target_days-1) if h.target_days else None
    return {"id":h.id,"name":h.name,"description":h.description,"category":h.category,"schedule":h.schedule,"created_on":h.created_on.isoformat(),"end_on":h.end_on.isoformat() if h.end_on else None,"icon":h.icon,"color":h.color,"target_days":h.target_days,"target_text":h.target_text,"daily_target":h.daily_target,"target_unit":h.target_unit,"reminder_time":h.reminder_time,"target_end":end.isoformat() if end else None,"completed_days":done,"goal_progress":min(100,round(100*done/h.target_days)) if h.target_days else 0,"goal_complete":bool(h.target_days and done>=h.target_days),"active":bool(h.active),"archived_on":h.archived_on.isoformat() if h.archived_on else None,"is_demo":bool(h.is_demo),"scheduled_today":occurs(h,today),"done_today":today in dates(s,h),**streak(s,h,today)}
def day_status(s,u,d):
    scheduled=[h for h in habits(s,u) if occurs(h,d)]
    return sum(d in dates(s,h) for h in scheduled),len(scheduled)
def partial_count(s,u,d):
    scheduled_ids=[h.id for h in habits(s,u) if occurs(h,d)]
    return s.query(Completion).filter(Completion.user_id==u.id,Completion.habit_id.in_(scheduled_ids),Completion.completed_on==d,Completion.status=="partial").count() if scheduled_ids else 0
def period_status(s,u,start,end):
    completed=scheduled=0
    cursor=start
    while cursor<=end:
        done,total=day_status(s,u,cursor); completed+=done; scheduled+=total; cursor+=timedelta(days=1)
    return {"completed":completed,"scheduled":scheduled,"percentage":round(100*completed/scheduled) if scheduled else 0}
def count(s,u): return s.query(Completion).filter_by(user_id=u.id,status="complete").count()
def add_xp(s,u,source,amount,key,related_id="",event_date=None):
    if s.query(XPTransaction).filter_by(user_id=u.id,idempotency_key=key).first(): return 0
    s.add(XPTransaction(user_id=u.id,source=source,amount=amount,idempotency_key=key,related_id=str(related_id),event_date=event_date or date.today()))
    u.xp=max(0,u.xp+amount); return amount
def reverse_xp(s,u,source_key,source="correction"):
    original=s.query(XPTransaction).filter_by(user_id=u.id,idempotency_key=source_key).first()
    if not original or original.amount<=0: return 0
    return add_xp(s,u,source,-original.amount,f"reverse:{source_key}",original.related_id,original.event_date)
def bonus(s,u,d):
    done,total=day_status(s,u,d); key=f"daily_all:{d.isoformat()}"; claim=s.query(RewardClaim).filter_by(user_id=u.id,reward_key=key).first()
    if total and done==total and not claim:
        awarded=add_xp(s,u,"daily_bonus",DAILY_BONUS_XP,key,d.isoformat(),d)
        s.add(RewardClaim(user_id=u.id,reward_key=key,amount=awarded))
    elif claim and done<total and claim.amount:
        reverse_xp(s,u,key,"daily_bonus_reversal"); claim.amount=0
ACHIEVEMENT_DEFS = [
    {"code":"first_step","title":"First Step","description":"Complete your first habit.","requirement":"Complete 1 habit","category":"Habit Milestones","target":1,"metric":"total","accent":"green","emblem":"leaf"},
    {"code":"three_days","title":"Three-Day Spark","description":"Keep one habit going for 3 scheduled days.","requirement":"Reach a 3-day habit streak","category":"Streak Legends","target":3,"metric":"best","accent":"orange","emblem":"flame"},
    {"code":"seven_days","title":"Week Warrior","description":"Build a full 7-day scheduled streak.","requirement":"Reach a 7-day habit streak","category":"Streak Legends","target":7,"metric":"best","accent":"blue","emblem":"shield"},
    {"code":"fourteen_days","title":"Consistency Builder","description":"Show up for 14 scheduled days in a row.","requirement":"Reach a 14-day habit streak","category":"Consistency Champions","target":14,"metric":"best","accent":"purple","emblem":"plant"},
    {"code":"thirty_completions","title":"Steady Hand","description":"Collect 30 persisted habit completions.","requirement":"Complete habits 30 times","category":"Habit Milestones","target":30,"metric":"total","accent":"gold","emblem":"medal"},
]
def achievement_catalog(s,u,today=None):
    total=count(s,u); best=max((streak(s,h,today)["longest"] for h in habits(s,u)),default=0)
    unlocked={a.code:a.unlocked_on for a in s.query(Achievement).filter_by(user_id=u.id)}
    result=[]
    for definition in ACHIEVEMENT_DEFS:
        progress=total if definition["metric"]=="total" else best
        target=definition["target"]
        result.append({**definition,"progress":min(progress,target),"remaining":max(0,target-progress),"reward_xp":ACHIEVEMENT_XP[definition["code"]],"unlocked_on":unlocked.get(definition["code"]).isoformat() if unlocked.get(definition["code"]) else None})
    return result
def achievements(s,u,today=None):
    total=count(s,u); best=max((streak(s,h,today)["longest"] for h in habits(s,u)),default=0); rules=[("first_step",total>=1),("three_days",best>=3),("seven_days",best>=7),("fourteen_days",best>=14),("thirty_completions",total>=30)]
    have={a.code for a in s.query(Achievement).filter_by(user_id=u.id)}
    for code,yes in rules:
        if yes and code not in have:
            s.add(Achievement(user_id=u.id,code=code,unlocked_on=today or date.today()))
            add_xp(s,u,"achievement",ACHIEVEMENT_XP[code],f"achievement:{code}",code,today or date.today())
def overall(s,u,today=None):
    hs=habits(s,u); current_day=today or date.today(); cursor=current_day; run=0
    while hs and cursor>=min(h.created_on for h in hs):
        done,total=day_status(s,u,cursor)
        if total and done==total: run+=1
        elif total and cursor==current_day: pass
        elif total: break
        cursor-=timedelta(days=1)
    return run
def overall_longest(s,u,today=None):
    hs=habits(s,u)
    if not hs: return 0
    cursor=min(h.created_on for h in hs); end=today or date.today(); run=longest=0
    while cursor<=end:
        done,total=day_status(s,u,cursor)
        if total:
            run=run+1 if done==total else 0
            longest=max(longest,run)
        cursor+=timedelta(days=1)
    return longest
def public_name(name):
    parts=name.strip().split()
    return parts[0] if len(parts)<=1 else f"{parts[0]} {parts[-1][0].upper()}."
def invite_hash(token): return sha256(token.encode("utf-8")).hexdigest()
def invitation_for_token(s,token,include_inactive=False):
    if len(token)<20 or len(token)>200: return None
    invitation=s.query(Invitation).filter_by(token_hash=invite_hash(token)).first()
    if not invitation: return None
    if not include_inactive and (invitation.revoked_at is not None or invitation.expires_at<=utc_now()): return None
    return invitation
@app.get("/health")
def health(): return {"status":"ok"}
@app.post("/auth/register")
def register(data:Credentials,s:Session=Depends(db)):
    if s.query(User).filter_by(email=data.email.lower()).first(): raise HTTPException(409,"That email is already registered.")
    invitation=None
    if data.invite_token:
        invitation=invitation_for_token(s,data.invite_token)
        if not invitation: raise HTTPException(410,"This invitation is invalid, expired, or revoked.")
    token,expires=issue_token(); u=User(name=data.name.strip() or "Questor",email=data.email.strip().lower(),password_hash=hash_password(data.password),token=token,token_expires_at=expires); s.add(u)
    if invitation: invitation.uses+=1
    s.commit(); return {"token":u.token,"expires_at":expires.isoformat()+"Z","user":{"name":u.name,**level(u.xp)}}
@app.post("/auth/login")
def login(data:Credentials,s:Session=Depends(db)):
    u=s.query(User).filter_by(email=data.email.strip().lower()).first(); valid,upgrade=verify_password(data.password,u.password_hash) if u else (False,False)
    if not valid: raise HTTPException(401,"Email or password is incorrect.")
    token,expires=issue_token(); u.token=token; u.token_expires_at=expires
    if upgrade: u.password_hash=hash_password(data.password)
    s.commit(); return {"token":u.token,"expires_at":expires.isoformat()+"Z","user":{"name":u.name,**level(u.xp)}}
@app.post("/auth/logout",status_code=204)
def logout(u:User=Depends(auth),s:Session=Depends(db)):
    token,_=issue_token(); u.token=token; u.token_expires_at=utc_now(); s.commit()
@app.post("/invites",status_code=201)
def create_invitation(u:User=Depends(auth),s:Session=Depends(db)):
    raw=token_urlsafe(32); expires=utc_now()+timedelta(days=7)
    s.add(Invitation(inviter_user_id=u.id,token_hash=invite_hash(raw),expires_at=expires)); s.commit()
    return {"token":raw,"expires_at":expires.isoformat()+"Z","message":"Share this link with a friend. Registration and leaderboard participation remain their choice."}
@app.get("/invites/{token}")
def inspect_invitation(token:str,s:Session=Depends(db)):
    invitation=invitation_for_token(s,token)
    if not invitation: raise HTTPException(410,"This invitation is invalid, expired, or revoked.")
    inviter=s.query(User).filter_by(id=invitation.inviter_user_id).first()
    if not inviter: raise HTTPException(410,"This invitation is no longer available.")
    return {"valid":True,"inviter_display_name":public_name(inviter.name),"expires_at":invitation.expires_at.isoformat()+"Z"}
@app.delete("/invites/{token}",status_code=204)
def revoke_invitation(token:str,u:User=Depends(auth),s:Session=Depends(db)):
    invitation=invitation_for_token(s,token,include_inactive=True)
    if not invitation or invitation.inviter_user_id!=u.id: raise HTTPException(404,"Invitation not found.")
    if invitation.revoked_at is None: invitation.revoked_at=utc_now(); s.commit()
@app.get("/me")
def me(u:User=Depends(auth)): return {"name":u.name,"email":u.email,"leaderboard_opt_in":bool(u.leaderboard_opt_in),**level(u.xp)}
@app.get("/habits")
def list_habits(status:str="all",on_date:date|None=None,u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    if status not in ("all","active","archived"): raise HTTPException(422,"Status must be all, active, or archived.")
    rows=habits(s,u)
    if status!="all": rows=[h for h in rows if bool(h.active)==(status=="active")]
    if on_date: rows=[h for h in rows if occurs(h,on_date)]
    return [habit_out(s,h,today) for h in rows]
@app.get("/habits/{hid}")
def get_habit(hid:int,u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)): return habit_out(s,owned(hid,u,s),today)
@app.get("/habits/{hid}/history")
def habit_history(hid:int,start:date|None=None,end:date|None=None,u:User=Depends(auth),s:Session=Depends(db)):
    h=owned(hid,u,s); start=start or h.created_on; end=end or date.today()
    if start>end or (end-start).days>730: raise HTTPException(422,"Use a valid range of at most 730 days.")
    rows=s.query(Completion).filter(Completion.habit_id==hid,Completion.completed_on>=start,Completion.completed_on<=end).order_by(Completion.completed_on).all()
    return {"habit_id":hid,"start":start.isoformat(),"end":end.isoformat(),"records":[{"date":r.completed_on.isoformat(),"status":r.status,"recorded_value":r.recorded_value,"note":r.note} for r in rows],"streak":streak(s,h,end)}
@app.get("/days/{selected_day}")
def day_view(selected_day:date,u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    if selected_day>today: raise HTTPException(422,"Future dates cannot be completed yet.")
    rows=[]
    for h in habits(s,u):
        if occurs(h,selected_day):
            record=s.query(Completion).filter_by(habit_id=h.id,completed_on=selected_day).first()
            rows.append({"id":h.id,"name":h.name,"description":h.description,"category":h.category,"schedule":h.schedule,"icon":h.icon,"color":h.color,"done":bool(record and record.status=="complete"),"progress":record.recorded_value if record else None,"note":record.note if record else "","daily_target":h.daily_target,"target_unit":h.target_unit,"can_toggle":True,**streak(s,h,today)})
    done=sum(x["done"] for x in rows)
    partial=sum(bool(x["progress"] is not None and not x["done"]) for x in rows)
    return {"date":selected_day.isoformat(),"completed":done,"partial":partial,"missed":max(0,len(rows)-done-partial),"scheduled":len(rows),"habits":rows}
@app.get("/calendar/{year}/{month}")
def month_view(year:int,month:int,u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    if month<1 or month>12: raise HTTPException(422,"Month must be 1 through 12.")
    first=date(year,month,1); next_month=date(year+1,1,1) if month==12 else date(year,month+1,1); cursor=first; days=[]
    while cursor<next_month:
        scheduled_habits=[h for h in habits(s,u) if occurs(h,cursor)]
        records={row.habit_id:row for row in s.query(Completion).filter(Completion.user_id==u.id,Completion.completed_on==cursor).all()} if cursor<=today else {}
        done=sum(bool(records.get(h.id) and records[h.id].status=="complete") for h in scheduled_habits) if cursor<=today else 0
        total=len(scheduled_habits) if cursor<=today else 0
        categories=list(dict.fromkeys(h.category for h in scheduled_habits))
        partial=partial_count(s,u,cursor) if cursor<=today else 0
        activities=[]
        for h in scheduled_habits:
            record=records.get(h.id)
            status="upcoming" if cursor>today else "complete" if record and record.status=="complete" else "partial" if record and record.status=="partial" else "missed"
            activities.append({"name":h.name,"color":h.color,"status":status})
        days.append({"date":cursor.isoformat(),"completed":done,"partial":partial,"scheduled":total,"percentage":round(100*done/total) if total else 0,"categories":categories,"activities":activities})
        cursor+=timedelta(days=1)
    return {"year":year,"month":month,"days":days}
@app.get("/activity")
def activity(days:int=70,u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    if days not in (70,84,183,365): raise HTTPException(422,"Activity range must be 70, 84, 183, or 365 days.")
    cells=[]
    for offset in range(days-1,-1,-1):
        current=today-timedelta(days=offset); done,total=day_status(s,u,current)
        partial=partial_count(s,u,current)
        cells.append({"date":current.isoformat(),"completed":done,"partial":partial,"scheduled":total,"intensity":max(1,min(4,round(4*(done+.5*partial)/total))) if (done or partial) and total else 0,"streak_day":bool(total and done==total)})
    active_days=sum(c["completed"]>0 for c in cells); completed=sum(c["completed"] for c in cells)
    return {"days":days,"cells":cells,"stats":{"completed":completed,"active_days":active_days,"current_streak":overall(s,u,today),"longest_habit_streak":max((streak(s,h,today)["longest"] for h in habits(s,u)),default=0)}}
@app.get("/habit-activity")
def habit_activity(days:int=84,habit_ids:str="",u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    if days not in (84,183,365): raise HTTPException(422,"Habit activity range must be 84, 183, or 365 days.")
    try: requested=list(dict.fromkeys(int(value) for value in habit_ids.split(",") if value.strip()))
    except ValueError: raise HTTPException(422,"Habit IDs must be comma-separated integers.")
    if len(requested)>4: raise HTTPException(422,"Select at most four habits at a time.")
    if requested:
        selected=[owned(hid,u,s) for hid in requested]
        selected=[h for h in selected if h.active]
    else: selected=[h for h in habits(s,u) if h.active][:4]
    start=today-timedelta(days=days-1); result=[]
    for h in selected:
        records={row.completed_on:row for row in s.query(Completion).filter(Completion.habit_id==h.id,Completion.completed_on>=start,Completion.completed_on<=today).all()}
        cells=[]; completed=partial=scheduled=0
        for offset in range(days):
            current=start+timedelta(days=offset); record=records.get(current)
            if current>today: status="future"; intensity=0
            elif not occurs(h,current): status="rest"; intensity=0
            else:
                scheduled+=1
                if record and record.status=="complete": status="complete"; intensity=4; completed+=1
                elif record and record.status=="partial":
                    status="partial"; partial+=1
                    ratio=(record.recorded_value or 0)/(h.daily_target or max(record.recorded_value or 1,1))
                    intensity=max(1,min(3,round(ratio*3)))
                else: status="missed"; intensity=0
            cells.append({"date":current.isoformat(),"status":status,"intensity":intensity,"recorded_value":record.recorded_value if record else None,"note":record.note if record else ""})
        week_start=today-timedelta(days=today.weekday()); month_start=today.replace(day=1)
        def summary(period_start):
            opportunities=[period_start+timedelta(days=i) for i in range((today-period_start).days+1) if occurs(h,period_start+timedelta(days=i))]
            successes=sum(day in dates(s,h) for day in opportunities)
            return {"completed":successes,"scheduled":len(opportunities),"percentage":round(100*successes/len(opportunities)) if opportunities else 0}
        result.append({"id":h.id,"name":h.name,"icon":h.icon,"color":h.color,"category":h.category,"schedule":h.schedule,"daily_target":h.daily_target,"target_unit":h.target_unit,"cells":cells,"stats":{"current_streak":streak(s,h,today)["current"],"best_streak":streak(s,h,today)["longest"],"completed":completed,"partial":partial,"scheduled":scheduled,"completion_rate":round(100*completed/scheduled) if scheduled else 0,"weekly":summary(week_start),"monthly":summary(month_start)}})
    return {"days":days,"selected_count":len(result),"habits":result}
@app.get("/analytics")
def analytics(u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    hs=habits(s,u)
    daily=[{"label":(today-timedelta(days=i)).isoformat(),**period_status(s,u,today-timedelta(days=i),today-timedelta(days=i))} for i in range(29,-1,-1)]
    week_start=today-timedelta(days=today.weekday())
    weekly=[{"label":(week_start-timedelta(days=7*i)).isoformat(),**period_status(s,u,week_start-timedelta(days=7*i),min(today,week_start-timedelta(days=7*i)+timedelta(days=6)))} for i in range(7,-1,-1)]
    monthly=[]
    for i in range(5,-1,-1):
        year=today.year; month=today.month-i
        while month<=0: year-=1; month+=12
        first=date(year,month,1); next_month=date(year+1,1,1) if month==12 else date(year,month+1,1)
        monthly.append({"label":first.isoformat()[:7],**period_status(s,u,first,min(today,next_month-timedelta(days=1)))})
    previous_week_start=week_start-timedelta(days=7)
    previous_week=period_status(s,u,previous_week_start,previous_week_start+timedelta(days=today.weekday()))
    previous_month_end=today.replace(day=1)-timedelta(days=1)
    previous_month_start=previous_month_end.replace(day=1)
    previous_month=period_status(s,u,previous_month_start,min(previous_month_end,previous_month_start+timedelta(days=today.day-1)))
    start=today-timedelta(days=29); habit_rates=[]
    for h in hs:
        scheduled_dates=[start+timedelta(days=i) for i in range(30) if occurs(h,start+timedelta(days=i))]
        if scheduled_dates:
            completed=sum(d in dates(s,h) for d in scheduled_dates)
            habit_rates.append({"id":h.id,"name":h.name,"category":h.category,"completed":completed,"scheduled":len(scheduled_dates),"percentage":round(100*completed/len(scheduled_dates))})
    categories=[]
    for category in sorted({h["category"] for h in habit_rates}):
        items=[h for h in habit_rates if h["category"]==category]; done=sum(h["completed"] for h in items); total=sum(h["scheduled"] for h in items)
        categories.append({"name":category,"completed":done,"scheduled":total,"percentage":round(100*done/total) if total else 0})
    return {"daily":daily,"weekly":weekly,"monthly":monthly,"previous_week":previous_week,"previous_month":previous_month,"habits":habit_rates,"categories":categories,"current_streak":overall(s,u,today),"longest_habit_streak":max((streak(s,h,today)["longest"] for h in hs),default=0)}
@app.post("/habits",status_code=201)
def create(data:HabitInput,u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    if not valid_schedule(data.schedule): raise HTTPException(422,"Schedule must be daily or comma-separated weekday numbers 0-6.")
    if data.start_date and data.start_date>today: raise HTTPException(422,"Start date cannot be in the future.")
    if data.end_date and data.end_date<(data.start_date or today): raise HTTPException(422,"End date cannot be before the start date.")
    values=data.model_dump(); values["created_on"]=values.pop("start_date") or today; values["end_on"]=values.pop("end_date")
    if not values["color"]: values["color"]=HABIT_COLORS[s.query(Habit).filter_by(user_id=u.id).count()%len(HABIT_COLORS)]
    h=Habit(user_id=u.id,**values); s.add(h); s.commit(); return habit_out(s,h,today)
@app.put("/habits/{hid}")
def update(hid:int,data:HabitInput,u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    if not valid_schedule(data.schedule): raise HTTPException(422,"Schedule must be daily or comma-separated weekday numbers 0-6.")
    h=owned(hid,u,s)
    if h.schedule!=data.schedule:
        for period in h.schedule_periods:
            if period.ended_on is None: period.ended_on=today
        if not h.schedule_periods:
            h.schedule_periods.append(SchedulePeriod(started_on=h.created_on,ended_on=today,schedule=h.schedule))
        h.schedule_periods.append(SchedulePeriod(started_on=today,schedule=data.schedule))
    if data.end_date and data.end_date<h.created_on: raise HTTPException(422,"End date cannot be before the start date.")
    values=data.model_dump(); values.pop("start_date"); values["end_on"]=values.pop("end_date")
    if not values["color"]: values["color"]=h.color
    for k,v in values.items(): setattr(h,k,v)
    s.commit(); return habit_out(s,h,today)
@app.post("/habits/{hid}/archive")
def archive(hid:int,u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    h=owned(hid,u,s)
    if not h.active: raise HTTPException(409,"Habit is already archived.")
    h.active=0; h.archived_on=today; h.archive_periods.append(ArchivePeriod(started_on=today)); s.commit(); return {"message":"Habit archived"}
@app.post("/habits/{hid}/restore")
def restore(hid:int,u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    h=owned(hid,u,s)
    if h.active: raise HTTPException(409,"Habit is already active.")
    for period in h.archive_periods:
        if period.ended_on is None: period.ended_on=today
    h.active=1; h.archived_on=None; s.commit(); return habit_out(s,h,today)
@app.post("/demo/sample")
def load_demo(u:User=Depends(auth),s:Session=Depends(db)):
    """Explicitly create a seven-day, labelled sample history for the signed-in account only."""
    if count(s,u): raise HTTPException(409,"Demo data can only be loaded into an account with no completions. Use reset first.")
    start=date.today()-timedelta(days=27)
    if s.query(Habit).filter_by(user_id=u.id,is_demo=1).first(): raise HTTPException(409,"Sample history is already loaded.")
    dsa=Habit(user_id=u.id,name="Demo: practise DSA",description="Solve two questions",category="Study",schedule="daily",created_on=start,icon="code",color="#3182CE",target_days=30,target_text="2 questions",is_demo=1)
    move=Habit(user_id=u.id,name="Demo: move your body",description="A 20 minute walk",category="Health",schedule="0,1,2,3,4,5",created_on=start,icon="walk",color="#2E9E6F",target_days=14,target_text="20 minutes",is_demo=1)
    s.add_all([dsa,move]); s.flush()
    created=0
    for offset in range(28):
        day=start+timedelta(days=offset)
        if offset not in (4,11,18): s.add(Completion(habit_id=dsa.id,user_id=u.id,completed_on=day)); add_xp(s,u,"completion",COMPLETION_XP,f"completion:{dsa.id}:{day}",dsa.id,day); created+=1
        if is_scheduled(move,day) and offset not in (8,16): s.add(Completion(habit_id=move.id,user_id=u.id,completed_on=day)); add_xp(s,u,"completion",COMPLETION_XP,f"completion:{move.id}:{day}",move.id,day); created+=1
    s.flush()
    for offset in range(28): bonus(s,u,start+timedelta(days=offset))
    achievements(s,u); s.commit(); return {"message":"Four weeks of clearly labelled sample history loaded."}
@app.delete("/demo/sample",status_code=204)
def reset_demo(u:User=Depends(auth),s:Session=Depends(db)):
    """Delete only explicitly generated demo habits, then recalculate real-account rewards."""
    ids=[h.id for h in s.query(Habit).filter_by(user_id=u.id,is_demo=1)]
    if ids: s.query(Completion).filter(Completion.habit_id.in_(ids)).delete(synchronize_session=False)
    if ids: s.query(Habit).filter(Habit.id.in_(ids)).delete(synchronize_session=False)
    s.query(XPTransaction).filter_by(user_id=u.id).delete(); s.query(RewardClaim).filter_by(user_id=u.id).delete(); s.query(Achievement).filter_by(user_id=u.id).delete(); u.xp=0
    real=s.query(Completion).filter_by(user_id=u.id,status="complete").all()
    for row in real: add_xp(s,u,"completion",COMPLETION_XP,f"completion:{row.habit_id}:{row.completed_on.isoformat()}",row.habit_id,row.completed_on)
    for day in sorted({row.completed_on for row in real}): bonus(s,u,day)
    achievements(s,u); s.commit()
@app.delete("/habits/{hid}",status_code=204)
def remove(hid:int,u:User=Depends(auth),s:Session=Depends(db)):
    h=owned(hid,u,s); rows=s.query(Completion).filter_by(habit_id=hid,status="complete").all(); affected={row.completed_on for row in rows}
    for row in rows: reverse_xp(s,u,f"completion:{hid}:{row.completed_on.isoformat()}","habit_delete_reversal")
    s.query(GoalHabit).filter_by(habit_id=hid).delete(); s.query(Completion).filter_by(habit_id=hid).delete(); s.delete(h); s.flush()
    for day in affected: bonus(s,u,day)
    s.commit()
@app.post("/habits/{hid}/complete")
def complete(hid:int,body:CompletionInput,u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    h=owned(hid,u,s); d=body.completed_on or today
    if d>today or not occurs(h,d): raise HTTPException(422,"This habit is not scheduled for that date.")
    existing=s.query(Completion).filter_by(habit_id=hid,completed_on=d).first()
    if existing and existing.status=="complete": raise HTTPException(409,"Already completed; XP was not awarded again.")
    if existing: existing.status="complete"; existing.recorded_value=body.recorded_value; existing.note=body.note
    else: s.add(Completion(habit_id=hid,user_id=u.id,completed_on=d,status="complete",recorded_value=body.recorded_value,note=body.note))
    awarded=add_xp(s,u,"completion",COMPLETION_XP,f"completion:{hid}:{d.isoformat()}",hid,d); s.flush(); bonus(s,u,d); achievements(s,u,today); s.commit(); return {"message":"Habit completed","xp_awarded":awarded,**level(u.xp)}
@app.delete("/habits/{hid}/complete")
def undo(hid:int,body:CompletionInput,u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    h=owned(hid,u,s); d=body.completed_on or today; c=s.query(Completion).filter_by(habit_id=hid,completed_on=d).first()
    if not c: raise HTTPException(404,"No completion exists for this date.")
    s.delete(c); reverse_xp(s,u,f"completion:{hid}:{d.isoformat()}"); s.flush(); bonus(s,u,d); s.commit(); return {"message":"Completion undone",**level(u.xp)}
@app.put("/habits/{hid}/progress")
def save_progress(hid:int,body:ProgressInput,u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    h=owned(hid,u,s); d=body.completed_on or today
    if d>today or not occurs(h,d): raise HTTPException(422,"This habit is not scheduled for that date.")
    if h.daily_target is None: raise HTTPException(422,"This habit does not have a numeric daily target.")
    row=s.query(Completion).filter_by(habit_id=hid,completed_on=d).first(); status="complete" if body.recorded_value>=h.daily_target else "partial"
    was_complete=bool(row and row.status=="complete")
    if row: row.status=status; row.recorded_value=body.recorded_value; row.note=body.note
    else: row=Completion(habit_id=hid,user_id=u.id,completed_on=d,status=status,recorded_value=body.recorded_value,note=body.note); s.add(row)
    awarded=0
    if status=="complete" and not was_complete: awarded=add_xp(s,u,"completion",COMPLETION_XP,f"completion:{hid}:{d.isoformat()}",hid,d)
    elif status!="complete" and was_complete: reverse_xp(s,u,f"completion:{hid}:{d.isoformat()}")
    s.flush(); bonus(s,u,d); achievements(s,u,today); s.commit()
    return {"date":d.isoformat(),"status":status,"recorded_value":body.recorded_value,"target":h.daily_target,"xp_awarded":awarded,**level(u.xp)}
@app.get("/dashboard")
def dashboard(u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    hs=habits(s,u); done,total=day_status(s,u,today); start=today-timedelta(days=today.weekday()); month_start=today.replace(day=1)
    heat=[]
    for i in range(69,-1,-1):
        d=today-timedelta(days=i); a,b=day_status(s,u,d); heat.append({"date":d.isoformat(),"completed":a,"scheduled":b,"intensity":round(100*a/b) if b else 0})
    active=sum(day_status(s,u,start+timedelta(days=i))[0]>0 for i in range(today.weekday()+1))
    return {"user":{"name":u.name,"leaderboard_opt_in":bool(u.leaderboard_opt_in),**level(u.xp)},"habits":[habit_out(s,h,today) for h in hs],"today":{"completed":done,"total":total,"bonus_claimed":bool(s.query(RewardClaim).filter_by(user_id=u.id,reward_key=f"daily_all:{today.isoformat()}").filter(RewardClaim.amount>0).first())},"overall_streak":overall(s,u,today),"overall_longest_streak":overall_longest(s,u,today),"weekly_consistency":period_status(s,u,start,today),"monthly_completion":period_status(s,u,month_start,today),"weekly_challenge":{"active_days":active,"target":5,"week_start":start.isoformat()},"heatmap":heat,"achievements":achievement_catalog(s,u,today)}

def goal_out(s,goal):
    habit_ids=[h.id for h in goal.habits]
    done=s.query(Completion).filter(Completion.user_id==goal.user_id,Completion.habit_id.in_(habit_ids),Completion.status=="complete",Completion.completed_on>=goal.start_on,Completion.completed_on<=goal.end_on).count() if habit_ids else 0
    target=goal.target_count; effective_status="expired" if goal.status=="active" and goal.end_on<date.today() else goal.status
    return {"id":goal.id,"title":goal.title,"description":goal.description,"target_count":target,"start_on":goal.start_on.isoformat(),"end_on":goal.end_on.isoformat(),"status":effective_status,"habit_ids":habit_ids,"completed":done,"remaining":max(0,target-done),"percentage":min(100,round(100*done/target)),"milestones":[{"value":value,"reached":done>=value} for value in sorted({max(1,round(target*.25)),max(1,round(target*.5)),max(1,round(target*.75)),target})]}
def owned_goal(gid,u,s):
    goal=s.query(Goal).filter_by(id=gid,user_id=u.id).first()
    if not goal: raise HTTPException(404,"Goal not found.")
    return goal
def apply_goal(data,goal,u,s):
    if data.start_on>data.end_on or (data.end_on-data.start_on).days>3650: raise HTTPException(422,"Use a valid goal period of at most 10 years.")
    linked=[]
    for hid in dict.fromkeys(data.habit_ids): linked.append(owned(hid,u,s))
    for key,value in data.model_dump(exclude={"habit_ids"}).items(): setattr(goal,key,value)
    goal.habits=linked

@app.get("/goals")
def list_goals(status:str="all",u:User=Depends(auth),s:Session=Depends(db)):
    if status not in ("all","active","paused","completed","expired"): raise HTTPException(422,"Invalid goal status.")
    result=[goal_out(s,g) for g in s.query(Goal).filter_by(user_id=u.id).order_by(Goal.id.desc())]
    return result if status=="all" else [g for g in result if g["status"]==status]
@app.post("/goals",status_code=201)
def create_goal(data:GoalInput,u:User=Depends(auth),s:Session=Depends(db)):
    goal=Goal(user_id=u.id,title=data.title,target_count=data.target_count,start_on=data.start_on,end_on=data.end_on); apply_goal(data,goal,u,s); s.add(goal); s.commit(); return goal_out(s,goal)
@app.get("/goals/{gid}")
def get_goal(gid:int,u:User=Depends(auth),s:Session=Depends(db)): return goal_out(s,owned_goal(gid,u,s))
@app.put("/goals/{gid}")
def update_goal(gid:int,data:GoalInput,u:User=Depends(auth),s:Session=Depends(db)):
    goal=owned_goal(gid,u,s); apply_goal(data,goal,u,s); s.commit(); return goal_out(s,goal)
@app.post("/goals/{gid}/{action}")
def change_goal_status(gid:int,action:str,u:User=Depends(auth),s:Session=Depends(db)):
    if action not in ("pause","resume","complete"): raise HTTPException(404,"Unknown goal action.")
    goal=owned_goal(gid,u,s); goal.status={"pause":"paused","resume":"active","complete":"completed"}[action]; s.commit(); return goal_out(s,goal)
@app.delete("/goals/{gid}",status_code=204)
def delete_goal(gid:int,u:User=Depends(auth),s:Session=Depends(db)): s.delete(owned_goal(gid,u,s)); s.commit()

@app.get("/gamification/profile")
def gamification_profile(u:User=Depends(auth),s:Session=Depends(db)):
    return {**level(u.xp),"total_earned":sum(max(0,x.amount) for x in s.query(XPTransaction).filter_by(user_id=u.id)),"total_reversed":-sum(min(0,x.amount) for x in s.query(XPTransaction).filter_by(user_id=u.id)),"achievement_count":s.query(Achievement).filter_by(user_id=u.id).count()}
@app.get("/gamification/xp")
def xp_history(limit:int=50,u:User=Depends(auth),s:Session=Depends(db)):
    if limit<1 or limit>200: raise HTTPException(422,"Limit must be from 1 to 200.")
    rows=s.query(XPTransaction).filter_by(user_id=u.id).order_by(XPTransaction.id.desc()).limit(limit)
    return [{"source":x.source,"amount":x.amount,"idempotency_key":x.idempotency_key,"related_id":x.related_id,"created_at":x.created_at.isoformat()+"Z"} for x in rows]
@app.get("/gamification/achievements")
def earned_achievements(u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    achievements(s,u,today); s.commit(); return achievement_catalog(s,u,today)

@app.put("/me/leaderboard")
def set_leaderboard(data:LeaderboardInput,u:User=Depends(auth),s:Session=Depends(db)):
    u.leaderboard_opt_in=1 if data.enabled else 0; s.commit()
    return {"leaderboard_opt_in":bool(u.leaderboard_opt_in)}

@app.get("/leaderboard")
def leaderboard(period:str="all_time",u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    if period not in ("all_time","week"): raise HTTPException(422,"Period must be all_time or week.")
    participants=s.query(User).filter_by(leaderboard_opt_in=1).all()
    week_start=today-timedelta(days=today.weekday())
    scores=[]
    for person in participants:
        if period=="all_time": score=person.xp
        else:
            score=sum(x.amount for x in s.query(XPTransaction).filter(XPTransaction.user_id==person.id,XPTransaction.event_date>=week_start,XPTransaction.event_date<=today))
            score=max(0,score)
        scores.append((person,score))
    scores.sort(key=lambda row:(-row[1],row[0].name.casefold(),row[0].id))
    entries=[]; my_rank=None
    for rank,(person,score) in enumerate(scores,1):
        entry={"rank":rank,"display_name":public_name(person.name),"avatar":(person.name[:1] or "Q").upper(),"level":level(person.xp)["level"],"score":score}
        entries.append(entry)
        if person.id==u.id: my_rank=rank
    return {"period":period,"week_start":week_start.isoformat() if period=="week" else None,"score_label":"Weekly XP" if period=="week" else "All-time XP","participating":bool(u.leaderboard_opt_in),"my_rank":my_rank,"entries":entries}

@app.get("/insights")
def insights(u:User=Depends(auth),s:Session=Depends(db),today:date=Depends(client_today)):
    result=[]; current_start=today-timedelta(days=13); previous_start=current_start-timedelta(days=14); previous_end=current_start-timedelta(days=1)
    for h in habits(s,u):
        current=[current_start+timedelta(days=i) for i in range(14) if occurs(h,current_start+timedelta(days=i))]
        previous=[previous_start+timedelta(days=i) for i in range(14) if occurs(h,previous_start+timedelta(days=i))]
        if len(current)>=3 and len(previous)>=3:
            now=round(100*sum(d in dates(s,h) for d in current)/len(current)); before=round(100*sum(d in dates(s,h) for d in previous)/len(previous)); change=now-before
            if abs(change)>=15: result.append({"type":"trend","title":f"{h.name} is {'improving' if change>0 else 'slipping'}","explanation":f"Completion changed from {before}% to {now}% across two equal 14-day periods.","values":{"previous":before,"current":now,"change":change},"action":"Keep the same cue." if change>0 else "Try a smaller target or a clearer reminder."})
        scheduled=[today-timedelta(days=i) for i in range(13,-1,-1) if occurs(h,today-timedelta(days=i))]
        missed=[d for d in scheduled if d not in dates(s,h)]
        if len(scheduled)>=5 and len(missed)>=3: result.append({"type":"miss_pattern","title":f"{h.name} has repeat misses","explanation":f"{len(missed)} of {len(scheduled)} scheduled opportunities were missed in the last 14 days.","values":{"missed":len(missed),"scheduled":len(scheduled)},"action":"Review the schedule or make the daily target easier to start."})
    weekday=[]
    for weekday_index in range(7):
        days=[today-timedelta(days=i) for i in range(55,-1,-1) if (today-timedelta(days=i)).weekday()==weekday_index]
        done=sum(day_status(s,u,d)[0] for d in days); total=sum(day_status(s,u,d)[1] for d in days)
        if total>=4: weekday.append((round(100*done/total),weekday_index,total))
    if weekday:
        rate,index,total=max(weekday); result.append({"type":"weekday","title":f"{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][index]} is your strongest day","explanation":f"You completed {rate}% of {total} scheduled opportunities on that weekday in the last 8 weeks.","values":{"weekday":index,"rate":rate,"scheduled":total},"action":"Use that day for your most important habit."})
    return result[:8]
