"""Local-first HabitQuest API. Dates are ISO local calendar dates; a completion earns 20 XP and undo reverses it."""
from datetime import date, timedelta
import os
from hashlib import pbkdf2_hmac
from secrets import token_urlsafe
from typing import Generator
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import Column, Date, ForeignKey, Integer, String, UniqueConstraint, create_engine, inspect, text
from sqlalchemy.orm import Session, declarative_base, sessionmaker

DATABASE_URL = os.getenv("HABITQUEST_DATABASE_URL", "sqlite:///./habitquest.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine); Base = declarative_base()
class User(Base):
    __tablename__="users"; id=Column(Integer,primary_key=True); name=Column(String(80),nullable=False); email=Column(String(160),unique=True,nullable=False); password_hash=Column(String(128),nullable=False); xp=Column(Integer,default=0,nullable=False); token=Column(String(64),unique=True,nullable=False)
class Habit(Base):
    __tablename__="habits"; id=Column(Integer,primary_key=True); user_id=Column(Integer,ForeignKey("users.id"),nullable=False,index=True); name=Column(String(80),nullable=False); description=Column(String(240),default="",nullable=False); category=Column(String(40),default="Personal",nullable=False); schedule=Column(String(30),default="daily",nullable=False); created_on=Column(Date,default=date.today,nullable=False); active=Column(Integer,default=1,nullable=False); icon=Column(String(12),default="✦",nullable=False); target_days=Column(Integer,default=0,nullable=False); target_text=Column(String(120),default="",nullable=False); reminder_time=Column(String(5),default="",nullable=False); is_demo=Column(Integer,default=0,nullable=False)
class Completion(Base):
    __tablename__="completions"; id=Column(Integer,primary_key=True); habit_id=Column(Integer,ForeignKey("habits.id"),nullable=False,index=True); completed_on=Column(Date,nullable=False); __table_args__=(UniqueConstraint("habit_id","completed_on",name="unique_daily_completion"),)
class RewardClaim(Base):
    __tablename__="reward_claims"; id=Column(Integer,primary_key=True); user_id=Column(Integer,ForeignKey("users.id"),nullable=False); reward_key=Column(String(100),nullable=False); amount=Column(Integer,nullable=False); __table_args__=(UniqueConstraint("user_id","reward_key",name="unique_reward_claim"),)
class Achievement(Base):
    __tablename__="achievements"; id=Column(Integer,primary_key=True); user_id=Column(Integer,ForeignKey("users.id"),nullable=False); code=Column(String(40),nullable=False); unlocked_on=Column(Date,default=date.today,nullable=False); __table_args__=(UniqueConstraint("user_id","code",name="unique_achievement"),)
Base.metadata.create_all(engine)
# Lightweight backward-compatible migration for local project databases.
_columns={c["name"] for c in inspect(engine).get_columns("habits")}
for _name,_sql in {"active":"INTEGER NOT NULL DEFAULT 1","icon":"VARCHAR(12) NOT NULL DEFAULT '✦'","target_days":"INTEGER NOT NULL DEFAULT 0","target_text":"VARCHAR(120) NOT NULL DEFAULT ''","reminder_time":"VARCHAR(5) NOT NULL DEFAULT ''","is_demo":"INTEGER NOT NULL DEFAULT 0"}.items():
    if _name not in _columns:
        with engine.begin() as connection: connection.execute(text(f"ALTER TABLE habits ADD COLUMN {_name} {_sql}"))
app=FastAPI(title="HabitQuest API",version="1.0.0")
app.add_middleware(CORSMiddleware,allow_origins=["http://localhost:5173","http://127.0.0.1:5173"],allow_methods=["*"],allow_headers=["*"])
class Credentials(BaseModel): name:str=Field("",max_length=80); email:str=Field(min_length=3,max_length=160); password:str=Field(min_length=6,max_length=100)
class HabitInput(BaseModel):
    name:str=Field(min_length=1,max_length=80); description:str=Field("",max_length=240); category:str=Field("Personal",max_length=40); schedule:str="daily"; icon:str=Field("✦",max_length=12); start_date:date|None=None; target_days:int=Field(0,ge=0,le=3650); target_text:str=Field("",max_length=120); reminder_time:str=Field("",max_length=5)
class CompletionInput(BaseModel): completed_on:date|None=None
def db()->Generator[Session,None,None]:
    s=SessionLocal()
    try: yield s
    finally: s.close()
def digest(password): return pbkdf2_hmac("sha256",password.encode(),b"habitquest-local",100_000).hex()
def auth(authorization:str=Header(""),s:Session=Depends(db)):
    u=s.query(User).filter_by(token=authorization.removeprefix("Bearer ")).first()
    if not u: raise HTTPException(401,"Please sign in first.")
    return u
def level(xp):
    n=xp//100+1; return {"level":n,"xp":xp,"next_level_xp":n*100,"progress":xp%100}
def valid_schedule(x): return x=="daily" or bool(x) and all(part in "0123456" and len(part)==1 for part in x.split(","))
def is_scheduled(h,d): return h.schedule=="daily" or str(d.weekday()) in h.schedule.split(",")
def habits(s,u): return s.query(Habit).filter_by(user_id=u.id).order_by(Habit.id.desc()).all()
def owned(hid,u,s):
    h=s.query(Habit).filter_by(id=hid,user_id=u.id).first()
    if not h: raise HTTPException(404,"Habit not found.")
    return h
def dates(s,h): return {c.completed_on for c in s.query(Completion).filter_by(habit_id=h.id)}
def streak(s,h,today=None):
    today=today or date.today(); done=dates(s,h); cursor=today
    while cursor>=h.created_on and not is_scheduled(h,cursor): cursor-=timedelta(days=1)
    current=0
    while cursor>=h.created_on and cursor in done:
        current+=1; cursor-=timedelta(days=1)
        while cursor>=h.created_on and not is_scheduled(h,cursor): cursor-=timedelta(days=1)
    longest=run=0; cursor=h.created_on
    while cursor<=today:
        if is_scheduled(h,cursor): run=run+1 if cursor in done else 0; longest=max(longest,run)
        cursor+=timedelta(days=1)
    return {"current":current,"longest":longest}
def habit_out(s,h):
    done=len(dates(s,h)); end=h.created_on+timedelta(days=h.target_days-1) if h.target_days else None
    return {"id":h.id,"name":h.name,"description":h.description,"category":h.category,"schedule":h.schedule,"created_on":h.created_on.isoformat(),"icon":h.icon,"target_days":h.target_days,"target_text":h.target_text,"reminder_time":h.reminder_time,"target_end":end.isoformat() if end else None,"completed_days":done,"goal_progress":min(100,round(100*done/h.target_days)) if h.target_days else 0,"goal_complete":bool(h.target_days and done>=h.target_days),"active":bool(h.active),"is_demo":bool(h.is_demo),"scheduled_today":is_scheduled(h,date.today()),"done_today":date.today() in dates(s,h),**streak(s,h)}
def day_status(s,u,d):
    scheduled=[h for h in habits(s,u) if h.active and is_scheduled(h,d)]
    return sum(d in dates(s,h) for h in scheduled),len(scheduled)
def count(s,u): return s.query(Completion).join(Habit).filter(Habit.user_id==u.id).count()
def bonus(s,u,d):
    done,total=day_status(s,u,d); key=f"daily_all:{d.isoformat()}"; claim=s.query(RewardClaim).filter_by(user_id=u.id,reward_key=key).first()
    if total and done==total and not claim: s.add(RewardClaim(user_id=u.id,reward_key=key,amount=40)); u.xp+=40
    elif claim and done<total: u.xp=max(0,u.xp-claim.amount); s.delete(claim)
def achievements(s,u):
    total=count(s,u); best=max((streak(s,h)["longest"] for h in habits(s,u)),default=0); rules=[("first_step",total>=1),("three_days",best>=3),("seven_days",best>=7),("fourteen_days",best>=14),("thirty_completions",total>=30)]
    have={a.code for a in s.query(Achievement).filter_by(user_id=u.id)}
    for code,yes in rules:
        if yes and code not in have: s.add(Achievement(user_id=u.id,code=code))
def overall(s,u):
    hs=habits(s,u); cursor=date.today(); run=0
    while hs and cursor>=min(h.created_on for h in hs):
        done,total=day_status(s,u,cursor)
        if total and done==total: run+=1
        elif total: break
        cursor-=timedelta(days=1)
    return run
@app.get("/health")
def health(): return {"status":"ok"}
@app.post("/auth/register")
def register(data:Credentials,s:Session=Depends(db)):
    if s.query(User).filter_by(email=data.email.lower()).first(): raise HTTPException(409,"That email is already registered.")
    u=User(name=data.name.strip() or "Questor",email=data.email.lower(),password_hash=digest(data.password),token=token_urlsafe(24)); s.add(u); s.commit(); return {"token":u.token,"user":{"name":u.name,**level(u.xp)}}
@app.post("/auth/login")
def login(data:Credentials,s:Session=Depends(db)):
    u=s.query(User).filter_by(email=data.email.lower()).first()
    if not u or u.password_hash!=digest(data.password): raise HTTPException(401,"Email or password is incorrect.")
    return {"token":u.token,"user":{"name":u.name,**level(u.xp)}}
@app.post("/auth/logout",status_code=204)
def logout(u:User=Depends(auth),s:Session=Depends(db)):
    u.token=token_urlsafe(24); s.commit()
@app.get("/me")
def me(u:User=Depends(auth)): return {"name":u.name,"email":u.email,**level(u.xp)}
@app.get("/habits")
def list_habits(u:User=Depends(auth),s:Session=Depends(db)): return [habit_out(s,h) for h in habits(s,u)]
@app.get("/days/{selected_day}")
def day_view(selected_day:date,u:User=Depends(auth),s:Session=Depends(db)):
    if selected_day>date.today(): raise HTTPException(422,"Future dates cannot be completed yet.")
    rows=[]
    for h in habits(s,u):
        if h.active and h.created_on<=selected_day and is_scheduled(h,selected_day):
            rows.append({"id":h.id,"name":h.name,"description":h.description,"category":h.category,"done":selected_day in dates(s,h),**streak(s,h)})
    done=sum(x["done"] for x in rows)
    return {"date":selected_day.isoformat(),"completed":done,"scheduled":len(rows),"habits":rows}
@app.get("/calendar/{year}/{month}")
def month_view(year:int,month:int,u:User=Depends(auth),s:Session=Depends(db)):
    if month<1 or month>12: raise HTTPException(422,"Month must be 1 through 12.")
    first=date(year,month,1); next_month=date(year+1,1,1) if month==12 else date(year,month+1,1); cursor=first; days=[]
    while cursor<next_month:
        done,total=day_status(s,u,cursor) if cursor<=date.today() else (0,0)
        days.append({"date":cursor.isoformat(),"completed":done,"scheduled":total,"percentage":round(100*done/total) if total else 0})
        cursor+=timedelta(days=1)
    return {"year":year,"month":month,"days":days}
@app.get("/activity")
def activity(days:int=70,u:User=Depends(auth),s:Session=Depends(db)):
    if days not in (70,183,365): raise HTTPException(422,"Activity range must be 70, 183, or 365 days.")
    today=date.today(); cells=[]
    for offset in range(days-1,-1,-1):
        current=today-timedelta(days=offset); done,total=day_status(s,u,current)
        cells.append({"date":current.isoformat(),"completed":done,"scheduled":total,"intensity":min(4,round(4*done/total)) if total else 0,"streak_day":bool(total and done==total)})
    active_days=sum(c["completed"]>0 for c in cells); completed=sum(c["completed"] for c in cells)
    return {"days":days,"cells":cells,"stats":{"completed":completed,"active_days":active_days,"current_streak":overall(s,u),"longest_habit_streak":max((streak(s,h)["longest"] for h in habits(s,u)),default=0)}}
@app.post("/habits",status_code=201)
def create(data:HabitInput,u:User=Depends(auth),s:Session=Depends(db)):
    if not valid_schedule(data.schedule): raise HTTPException(422,"Schedule must be daily or comma-separated weekday numbers 0-6.")
    values=data.model_dump(); values["created_on"]=values.pop("start_date") or date.today(); h=Habit(user_id=u.id,**values); s.add(h); s.commit(); return habit_out(s,h)
@app.put("/habits/{hid}")
def update(hid:int,data:HabitInput,u:User=Depends(auth),s:Session=Depends(db)):
    if not valid_schedule(data.schedule): raise HTTPException(422,"Schedule must be daily or comma-separated weekday numbers 0-6.")
    h=owned(hid,u,s)
    values=data.model_dump(); values.pop("start_date")
    for k,v in values.items(): setattr(h,k,v)
    s.commit(); return habit_out(s,h)
@app.post("/habits/{hid}/archive")
def archive(hid:int,u:User=Depends(auth),s:Session=Depends(db)):
    h=owned(hid,u,s); h.active=0; s.commit(); return {"message":"Habit archived"}
@app.post("/demo/sample")
def load_demo(u:User=Depends(auth),s:Session=Depends(db)):
    """Explicitly create a seven-day, labelled sample history for the signed-in account only."""
    if count(s,u): raise HTTPException(409,"Demo data can only be loaded into an account with no completions. Use reset first.")
    start=date.today()-timedelta(days=27)
    if s.query(Habit).filter_by(user_id=u.id,is_demo=1).first(): raise HTTPException(409,"Sample history is already loaded.")
    dsa=Habit(user_id=u.id,name="Demo: practise DSA",description="Solve two questions",category="Study",schedule="daily",created_on=start,icon="⌘",target_days=30,target_text="2 questions",is_demo=1)
    move=Habit(user_id=u.id,name="Demo: move your body",description="A 20 minute walk",category="Health",schedule="0,1,2,3,4,5",created_on=start,icon="↗",target_days=14,target_text="20 minutes",is_demo=1)
    s.add_all([dsa,move]); s.flush()
    created=0
    for offset in range(28):
        day=start+timedelta(days=offset)
        if offset not in (4,11,18): s.add(Completion(habit_id=dsa.id,completed_on=day)); created+=1
        if is_scheduled(move,day) and offset not in (8,16): s.add(Completion(habit_id=move.id,completed_on=day)); created+=1
    u.xp+=created*20; s.flush()
    for offset in range(28): bonus(s,u,start+timedelta(days=offset))
    achievements(s,u); s.commit(); return {"message":"Four weeks of clearly labelled sample history loaded."}
@app.delete("/demo/sample",status_code=204)
def reset_demo(u:User=Depends(auth),s:Session=Depends(db)):
    """Delete only explicitly generated demo habits, then recalculate real-account rewards."""
    ids=[h.id for h in s.query(Habit).filter_by(user_id=u.id,is_demo=1)]
    if ids: s.query(Completion).filter(Completion.habit_id.in_(ids)).delete(synchronize_session=False)
    if ids: s.query(Habit).filter(Habit.id.in_(ids)).delete(synchronize_session=False)
    s.query(RewardClaim).filter_by(user_id=u.id).delete(); s.query(Achievement).filter_by(user_id=u.id).delete(); u.xp=count(s,u)*20; achievements(s,u); s.commit()
@app.delete("/habits/{hid}",status_code=204)
def remove(hid:int,u:User=Depends(auth),s:Session=Depends(db)):
    h=owned(hid,u,s); s.query(Completion).filter_by(habit_id=hid).delete(); s.delete(h); s.commit()
@app.post("/habits/{hid}/complete")
def complete(hid:int,body:CompletionInput,u:User=Depends(auth),s:Session=Depends(db)):
    h=owned(hid,u,s); d=body.completed_on or date.today()
    if not h.active: raise HTTPException(422,"Archived habits cannot be completed.")
    if d>date.today() or d<h.created_on or not is_scheduled(h,d): raise HTTPException(422,"This habit is not scheduled for that date.")
    if s.query(Completion).filter_by(habit_id=hid,completed_on=d).first(): raise HTTPException(409,"Already completed; XP was not awarded again.")
    s.add(Completion(habit_id=hid,completed_on=d)); u.xp+=20; s.flush(); bonus(s,u,d); achievements(s,u); s.commit(); return {"message":"Habit completed","xp_awarded":20,**level(u.xp)}
@app.delete("/habits/{hid}/complete")
def undo(hid:int,body:CompletionInput,u:User=Depends(auth),s:Session=Depends(db)):
    h=owned(hid,u,s); d=body.completed_on or date.today(); c=s.query(Completion).filter_by(habit_id=hid,completed_on=d).first()
    if not c: raise HTTPException(404,"No completion exists for this date.")
    s.delete(c); u.xp=max(0,u.xp-20); s.flush(); bonus(s,u,d); s.commit(); return {"message":"Completion undone",**level(u.xp)}
@app.get("/dashboard")
def dashboard(u:User=Depends(auth),s:Session=Depends(db)):
    today=date.today(); hs=habits(s,u); done,total=day_status(s,u,today); start=today-timedelta(days=today.weekday())
    heat=[]
    for i in range(69,-1,-1):
        d=today-timedelta(days=i); a,b=day_status(s,u,d); heat.append({"date":d.isoformat(),"completed":a,"scheduled":b,"intensity":round(100*a/b) if b else 0})
    active=sum(day_status(s,u,start+timedelta(days=i))[0]>0 for i in range(today.weekday()+1)); unlocked={x.code:x.unlocked_on.isoformat() for x in s.query(Achievement).filter_by(user_id=u.id)}; total_done=count(s,u); best=max((streak(s,h)["longest"] for h in hs),default=0)
    defs=[("first_step","First step","Complete one habit",min(1,total_done),1),("three_days","Three-day spark","Reach a 3-day habit streak",min(3,best),3),("seven_days","Week warrior","Reach a 7-day habit streak",min(7,best),7),("fourteen_days","Consistency builder","Reach a 14-day habit streak",min(14,best),14),("thirty_completions","Steady hand","Complete 30 habits",min(30,total_done),30)]
    return {"user":{"name":u.name,**level(u.xp)},"habits":[habit_out(s,h) for h in hs],"today":{"completed":done,"total":total,"bonus_claimed":bool(s.query(RewardClaim).filter_by(user_id=u.id,reward_key=f"daily_all:{today.isoformat()}").first())},"overall_streak":overall(s,u),"weekly_challenge":{"active_days":active,"target":5,"week_start":start.isoformat()},"heatmap":heat,"achievements":[{"code":c,"title":t,"description":x,"progress":p,"target":g,"unlocked_on":unlocked.get(c)} for c,t,x,p,g in defs]}
