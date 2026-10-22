from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import importlib
import os
os.environ["HABITQUEST_DATABASE_URL"] = "sqlite:///./habitquest-test.db"
import pytest
from fastapi.testclient import TestClient
from app.main import app, Base, engine, SessionLocal, Achievement, Completion, Habit, Invitation, User, XPTransaction

client = TestClient(app)
@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
def register(email="a@example.com",name="Ava"):
    response=client.post("/auth/register",json={"name":name,"email":email,"password":"password"})
    return {"Authorization":"Bearer "+response.json()["token"]}
def habit(headers,name="Read",schedule="daily"):
    return client.post("/habits",headers=headers,json={"name":name,"description":"test","category":"Study","schedule":schedule}).json()
def test_habit_crud_and_user_isolation():
    a=register(); b=register("b@example.com"); created=habit(a)
    assert client.get("/habits",headers=a).json()[0]["name"]=="Read"
    assert client.get("/habits",headers=b).json()==[]
    updated=client.put(f"/habits/{created['id']}",headers=a,json={"name":"Edited","description":"","category":"Personal","schedule":"daily"})
    assert updated.json()["name"]=="Edited"
    assert client.delete(f"/habits/{created['id']}",headers=b).status_code==404
    assert client.delete(f"/habits/{created['id']}",headers=a).status_code==204

def test_archive_restore_keeps_history_and_excludes_paused_dates():
    headers=register(); item=habit(headers)
    today=date.today().isoformat()
    client.post(f"/habits/{item['id']}/complete",headers=headers,json={})
    assert client.post(f"/habits/{item['id']}/archive",headers=headers).status_code==200
    assert client.get(f"/days/{today}",headers=headers).json()["scheduled"]==0
    assert client.get("/habits",headers=headers).json()[0]["completed_days"]==1
    assert client.post(f"/habits/{item['id']}/restore",headers=headers).status_code==200
    assert client.get(f"/days/{today}",headers=headers).json()["completed"]==1

def test_period_metrics_exclude_pre_creation_and_use_saved_completions():
    headers=register(); item=habit(headers)
    before=client.get("/dashboard",headers=headers).json()
    assert before["weekly_consistency"]["completed"]==0
    assert before["weekly_consistency"]["scheduled"]==1
    client.post(f"/habits/{item['id']}/complete",headers=headers,json={})
    after=client.get("/dashboard",headers=headers).json()
    assert after["weekly_consistency"]["percentage"]==100
    assert after["monthly_completion"]["percentage"]==100
    assert client.get("/analytics",headers=headers).json()["daily"][-1]["percentage"]==100

def test_editing_schedule_preserves_previous_dates():
    headers=register(); item=habit(headers)
    previous=date.today()-timedelta(days=1)
    with SessionLocal() as session:
        row=session.query(Habit).filter_by(id=item["id"]).one()
        row.created_on=previous; session.commit()
    changed=client.put(f"/habits/{item['id']}",headers=headers,json={"name":"Read","schedule":str(date.today().weekday())})
    assert changed.status_code==200
    yesterday=client.get(f"/days/{previous.isoformat()}",headers=headers).json()
    assert yesterday["scheduled"]==1

def test_client_timezone_sets_analytics_day_and_rejects_invalid_zone():
    headers=register()
    routes=["/dashboard","/activity?days=70",f"/days/{date.today().isoformat()}","/analytics"]
    for route in routes:
        assert client.get(route,headers=headers).status_code==200
    headers["X-Time-Zone"]=""
    for route in routes:
        assert client.get(route,headers=headers).status_code==200
    headers["X-Time-Zone"]="Asia/Kolkata"
    for route in routes:
        assert client.get(route,headers=headers).status_code==200
    headers["X-Time-Zone"]="Pacific/Kiritimati"
    for route in routes:
        assert client.get(route,headers=headers).status_code==200
    assert client.get("/analytics",headers=headers).json()["daily"][-1]["label"]==datetime.now(ZoneInfo("Pacific/Kiritimati")).date().isoformat()
    headers["X-Time-Zone"]="Invalid/Zone"
    for route in routes:
        response=client.get(route,headers=headers)
        assert response.status_code==422
        assert "X-Time-Zone" in response.json()["detail"]

def test_missing_server_timezone_data_has_distinct_error(monkeypatch):
    module=importlib.import_module("app.main")
    def unavailable(_name): raise ZoneInfoNotFoundError("missing database")
    monkeypatch.setattr(module,"ZoneInfo",unavailable)
    monkeypatch.setattr(module,"available_timezones",lambda: set())
    headers=register(); headers["X-Time-Zone"]="Asia/Kolkata"
    response=client.get("/dashboard",headers=headers)
    assert response.status_code==503
    assert "time zone data is unavailable" in response.json()["detail"]
def test_completion_undo_xp_and_duplicate_protection():
    h=register(); item=habit(h)
    # Completion (20) + all-done bonus (40) + first achievement (10).
    assert client.post(f"/habits/{item['id']}/complete",headers=h,json={}).json()["xp"]==70
    assert client.post(f"/habits/{item['id']}/complete",headers=h,json={}).status_code==409
    # The completion and daily bonus are reversed; a permanently earned badge is not revoked.
    assert client.request("DELETE",f"/habits/{item['id']}/complete",headers=h,json={}).json()["xp"]==10
def test_dashboard_real_quest_bonus_heatmap_and_achievement():
    h=register(); first=habit(h,"Read"); second=habit(h,"Move")
    client.post(f"/habits/{first['id']}/complete",headers=h,json={})
    state=client.get("/dashboard",headers=h).json()
    assert state["today"]["completed"]==1 and state["today"]["total"]==2
    assert state["user"]["xp"]==30 and state["achievements"][0]["unlocked_on"]
    client.post(f"/habits/{second['id']}/complete",headers=h,json={})
    state=client.get("/dashboard",headers=h).json()
    assert state["today"]["bonus_claimed"] and state["user"]["xp"]==90
    assert state["heatmap"][-1]["completed"]==2
def test_weekday_schedule_and_streak_history():
    h=register(); weekday=str(date.today().weekday()); item=habit(h,"Class notes",weekday)
    session=SessionLocal(); session.query(Habit).filter_by(id=item["id"]).update({"created_on":date.today()-timedelta(days=28)}); session.commit(); session.close()
    for n in range(3,0,-1):
        day=date.today()-timedelta(days=n*7)
        client.post(f"/habits/{item['id']}/complete",headers=h,json={"completed_on":day.isoformat()})
    client.post(f"/habits/{item['id']}/complete",headers=h,json={})
    record=client.get("/habits",headers=h).json()[0]
    assert record["current"]==4 and record["longest"]==4
    dashboard=client.get("/dashboard",headers=h).json()
    assert dashboard["overall_streak"]==4 and dashboard["overall_longest_streak"]==4
    client.request("DELETE",f"/habits/{item['id']}/complete",headers=h,json={"completed_on":date.today().isoformat()})
    dashboard=client.get("/dashboard",headers=h).json()
    assert dashboard["overall_streak"]==3 and dashboard["overall_longest_streak"]==3
def test_calendar_and_date_specific_history():
    h=register(); item=habit(h); yesterday=date.today()-timedelta(days=1)
    session=SessionLocal(); session.query(Habit).filter_by(id=item["id"]).update({"created_on":yesterday}); session.commit(); session.close()
    client.post(f"/habits/{item['id']}/complete",headers=h,json={"completed_on":yesterday.isoformat()})
    day=client.get(f"/days/{yesterday.isoformat()}",headers=h).json()
    assert day["completed"]==1 and day["habits"][0]["done"]
    month=client.get(f"/calendar/{yesterday.year}/{yesterday.month}",headers=h).json()
    assert any(x["date"]==yesterday.isoformat() and x["completed"]==1 and x["categories"]==["Study"] for x in month["days"])
    tomorrow=date.today()+timedelta(days=1)
    upcoming=client.get(f"/calendar/{tomorrow.year}/{tomorrow.month}",headers=h).json()
    assert any(x["date"]==tomorrow.isoformat() and x["completed"]==0 and x["categories"]==["Study"] for x in upcoming["days"])
def test_goal_duration_and_explicit_demo_history():
    h=register(); created=client.post("/habits",headers=h,json={"name":"DSA","description":"","category":"Study","schedule":"daily","icon":"⌘","target_days":7,"target_text":"2 questions"}).json()
    assert created["target_days"]==7 and created["target_end"]
    # A separate empty account may opt in to real, date-stamped demonstration records.
    demo=register("demo@example.com")
    assert client.post("/demo/sample",headers=demo).status_code==200
    dashboard=client.get("/dashboard",headers=demo).json()
    assert len(dashboard["habits"])==2 and dashboard["overall_streak"]>=7
    assert client.request("DELETE","/demo/sample",headers=demo).status_code==204
    assert client.get("/habits",headers=demo).json()==[]
def test_dates_remain_independent_when_switching_and_undoing():
    h=register(); item=habit(h); yesterday=date.today()-timedelta(days=1)
    session=SessionLocal(); session.query(Habit).filter_by(id=item["id"]).update({"created_on":yesterday}); session.commit(); session.close()
    client.post(f"/habits/{item['id']}/complete",headers=h,json={"completed_on":date.today().isoformat()})
    old=client.get(f"/days/{yesterday.isoformat()}",headers=h).json()
    current=client.get(f"/days/{date.today().isoformat()}",headers=h).json()
    assert old["habits"][0]["done"] is False and current["habits"][0]["done"] is True
    client.post(f"/habits/{item['id']}/complete",headers=h,json={"completed_on":yesterday.isoformat()})
    assert client.get(f"/days/{yesterday.isoformat()}",headers=h).json()["habits"][0]["done"] is True
    assert client.get(f"/days/{date.today().isoformat()}",headers=h).json()["habits"][0]["done"] is True
    client.request("DELETE",f"/habits/{item['id']}/complete",headers=h,json={"completed_on":yesterday.isoformat()})
    assert client.get(f"/days/{yesterday.isoformat()}",headers=h).json()["habits"][0]["done"] is False
    assert client.get(f"/days/{date.today().isoformat()}",headers=h).json()["habits"][0]["done"] is True
def test_activity_cells_are_real_dates_with_known_intensity():
    h=register(); a=habit(h,"A"); b=habit(h,"B")
    client.post(f"/habits/{a['id']}/complete",headers=h,json={})
    result=client.get("/activity?days=70",headers=h).json(); cell=result["cells"][-1]
    assert len(result["cells"])==70 and cell["date"]==date.today().isoformat()
    assert cell["completed"]==1 and cell["scheduled"]==2 and cell["intensity"]==2
    assert result["stats"]["completed"]==1
    assert len(client.get("/activity?days=84",headers=h).json()["cells"])==84

def test_auth_token_expires_and_password_hash_is_not_returned():
    response=client.post("/auth/register",json={"name":"Ava","email":"safe@example.com","password":"password"})
    assert "password" not in response.text.lower() and response.json()["expires_at"]
    headers={"Authorization":"Bearer "+response.json()["token"]}
    with SessionLocal() as session:
        user=session.query(User).filter_by(email="safe@example.com").one()
        user.token_expires_at=datetime(2000,1,1); session.commit()
    assert client.get("/me",headers=headers).status_code==401

def test_partial_progress_history_and_single_xp_award():
    headers=register(); created=client.post("/habits",headers=headers,json={"name":"Run","daily_target":5,"target_unit":"km"}).json()
    partial=client.put(f"/habits/{created['id']}/progress",headers=headers,json={"recorded_value":2.5,"note":"halfway"}).json()
    assert partial["status"]=="partial" and partial["xp"]==0
    finished=client.put(f"/habits/{created['id']}/progress",headers=headers,json={"recorded_value":5}).json()
    assert finished["status"]=="complete" and finished["xp_awarded"]==20
    history=client.get(f"/habits/{created['id']}/history",headers=headers).json()
    assert history["records"][0]["recorded_value"]==5
    assert client.put(f"/habits/{created['id']}/progress",headers=headers,json={"recorded_value":6}).json()["xp_awarded"]==0

def test_persistent_goal_crud_progress_and_isolation():
    headers=register(); other=register("goal-other@example.com"); item=habit(headers)
    payload={"title":"Seven check-ins","target_count":7,"start_on":date.today().isoformat(),"end_on":(date.today()+timedelta(days=14)).isoformat(),"habit_ids":[item["id"]]}
    created=client.post("/goals",headers=headers,json=payload)
    assert created.status_code==201 and created.json()["remaining"]==7
    assert client.get(f"/goals/{created.json()['id']}",headers=other).status_code==404
    client.post(f"/habits/{item['id']}/complete",headers=headers,json={})
    assert client.get(f"/goals/{created.json()['id']}",headers=headers).json()["completed"]==1
    assert client.post(f"/goals/{created.json()['id']}/pause",headers=headers).json()["status"]=="paused"
    assert client.post(f"/goals/{created.json()['id']}/resume",headers=headers).json()["status"]=="active"

def test_xp_ledger_records_award_and_one_reversal_only():
    headers=register(); item=habit(headers)
    client.post(f"/habits/{item['id']}/complete",headers=headers,json={})
    client.request("DELETE",f"/habits/{item['id']}/complete",headers=headers,json={})
    client.post(f"/habits/{item['id']}/complete",headers=headers,json={})
    client.request("DELETE",f"/habits/{item['id']}/complete",headers=headers,json={})
    ledger=client.get("/gamification/xp",headers=headers).json()
    completion_events=[row for row in ledger if row["idempotency_key"].endswith(date.today().isoformat()) and row["source"]=="completion"]
    assert len(completion_events)==1
    assert client.get("/gamification/profile",headers=headers).json()["xp"]==10

def test_current_streak_keeps_two_days_while_today_is_pending_then_extends():
    headers=register(); item=habit(headers); today=date.today()
    with SessionLocal() as session:
        row=session.query(Habit).filter_by(id=item["id"]).one(); row.created_on=today-timedelta(days=2)
        session.add_all([Completion(habit_id=row.id,user_id=row.user_id,completed_on=today-timedelta(days=2)),Completion(habit_id=row.id,user_id=row.user_id,completed_on=today-timedelta(days=1))]); session.commit()
    before=client.get("/dashboard",headers=headers).json()
    assert before["overall_streak"]==2
    assert client.get("/habits",headers=headers).json()[0]["current"]==2
    client.post(f"/habits/{item['id']}/complete",headers=headers,json={}).raise_for_status()
    after=client.get("/dashboard",headers=headers).json()
    assert after["overall_streak"]==3
    assert client.get("/habits",headers=headers).json()[0]["current"]==3

def test_expired_incomplete_scheduled_day_breaks_but_rest_days_do_not():
    headers=register(); today=date.today(); weekday=str(today.weekday()); item=habit(headers,"Weekly",weekday)
    with SessionLocal() as session:
        row=session.query(Habit).filter_by(id=item["id"]).one(); row.created_on=today-timedelta(days=21)
        session.add(Completion(habit_id=row.id,user_id=row.user_id,completed_on=today-timedelta(days=21))); session.commit()
    # Two intervening scheduled weekdays were missed. Ordinary unscheduled days are skipped,
    # but the latest expired scheduled opportunity breaks the current run.
    record=client.get("/habits",headers=headers).json()[0]
    assert record["current"]==0 and record["longest"]==1

def test_best_streak_is_separate_from_current_streak():
    headers=register(); item=habit(headers); today=date.today()
    with SessionLocal() as session:
        row=session.query(Habit).filter_by(id=item["id"]).one(); row.created_on=today-timedelta(days=5)
        session.add_all([Completion(habit_id=row.id,user_id=row.user_id,completed_on=today-timedelta(days=n)) for n in (5,4,3)])
        session.add(Completion(habit_id=row.id,user_id=row.user_id,completed_on=today-timedelta(days=1))); session.commit()
    record=client.get("/habits",headers=headers).json()[0]
    assert record["current"]==1 and record["longest"]==3

def test_level_progress_and_achievement_xp_are_idempotent():
    headers=register(); item=habit(headers)
    first=client.post(f"/habits/{item['id']}/complete",headers=headers,json={}).json()
    assert first["level"]==1 and first["xp"]==70 and first["xp_into_level"]==70 and first["xp_to_next_level"]==30
    assert client.get("/gamification/achievements",headers=headers).json()[0]["reward_xp"]==10
    assert client.get("/gamification/achievements",headers=headers).status_code==200
    with SessionLocal() as session:
        assert session.query(XPTransaction).filter_by(source="achievement",idempotency_key="achievement:first_step").count()==1

def test_leaderboard_is_opt_in_ordered_weekly_and_private():
    first=register("first@board.test","Ava Archer"); second=register("second@board.test","Ben Baker"); outsider=register("private@board.test","Private Person")
    first_habit=habit(first,"First"); second_habit=habit(second,"Second")
    client.put("/me/leaderboard",headers=first,json={"enabled":True}).raise_for_status()
    client.put("/me/leaderboard",headers=second,json={"enabled":True}).raise_for_status()
    client.post(f"/habits/{first_habit['id']}/complete",headers=first,json={}).raise_for_status()
    client.post(f"/habits/{second_habit['id']}/complete",headers=second,json={}).raise_for_status()
    with SessionLocal() as session:
        first_user=session.query(User).filter_by(email="first@board.test").one()
        # A legitimate older award affects all-time XP but not this week's score.
        first_user.xp+=200
        session.add(XPTransaction(user_id=first_user.id,source="historical",amount=200,idempotency_key="historical:first",event_date=date.today()-timedelta(days=8)))
        session.commit()
    all_time=client.get("/leaderboard?period=all_time",headers=first).json()
    weekly=client.get("/leaderboard?period=week",headers=first).json()
    assert all_time["entries"][0]["display_name"]=="Ava A." and all_time["entries"][0]["score"]==270
    assert len(all_time["entries"])==2 and weekly["entries"][0]["score"]==70
    serialized=str(all_time).lower()
    assert "archer" not in serialized and "email" not in serialized and "password" not in serialized and "token" not in serialized and "private@board.test" not in serialized
    assert client.get("/leaderboard",headers=outsider).json()["participating"] is False

def test_insights_are_structured_and_do_not_invent_empty_history():
    headers=register()
    assert client.get("/insights",headers=headers).json()==[]

def test_cors_preflight_accepts_vite_fallback_port_and_required_headers():
    origin="http://localhost:5175"
    response=client.options("/auth/register",headers={
        "Origin":origin,
        "Access-Control-Request-Method":"POST",
        "Access-Control-Request-Headers":"content-type,x-time-zone",
    })
    assert response.status_code==200
    assert response.headers["access-control-allow-origin"]==origin
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"].lower()
    assert "x-time-zone" in response.headers["access-control-allow-headers"].lower()
    assert "access-control-allow-credentials" not in response.headers

def test_cors_rejects_public_origin_and_registration_returns_cors_header():
    rejected=client.options("/auth/register",headers={
        "Origin":"https://malicious.example",
        "Access-Control-Request-Method":"POST",
        "Access-Control-Request-Headers":"content-type",
    })
    assert rejected.status_code==400
    assert "access-control-allow-origin" not in rejected.headers
    origin="http://127.0.0.1:5174"
    registered=client.post("/auth/register",headers={"Origin":origin},json={"name":"Cora","email":"cors@example.com","password":"password"})
    assert registered.status_code==200
    assert registered.headers["access-control-allow-origin"]==origin
    assert registered.json()["token"]

def test_habit_activity_is_individual_colored_scheduled_and_live():
    headers=register(); first=habit(headers,"Meditate"); second=habit(headers,"Exercise",str(date.today().weekday()))
    assert first["color"]!=second["color"]
    with SessionLocal() as session:
        session.query(Habit).filter(Habit.id.in_([first["id"],second["id"]])).update({"created_on":date.today()-timedelta(days=7)},synchronize_session=False); session.commit()
    client.post(f"/habits/{first['id']}/complete",headers=headers,json={})
    result=client.get(f"/habit-activity?days=84&habit_ids={first['id']},{second['id']}",headers=headers).json()
    assert result["selected_count"]==2
    by_id={item["id"]:item for item in result["habits"]}
    assert by_id[first["id"]]["cells"][-1]["status"]=="complete"
    assert by_id[first["id"]]["stats"]["completed"]==1
    assert by_id[second["id"]]["cells"][-1]["status"]=="missed"
    assert any(cell["status"]=="rest" for cell in by_id[second["id"]]["cells"][:-1])
    client.request("DELETE",f"/habits/{first['id']}/complete",headers=headers,json={})
    refreshed=client.get(f"/habit-activity?days=84&habit_ids={first['id']}",headers=headers).json()["habits"][0]
    assert refreshed["cells"][-1]["status"]=="missed" and refreshed["stats"]["completed"]==0

def test_habit_activity_selection_limit_partial_progress_and_isolation():
    headers=register(); other=register("activity-other@example.com")
    items=[habit(headers,f"Habit {index}") for index in range(5)]
    assert client.get("/habit-activity?days=84&habit_ids="+",".join(str(item["id"]) for item in items),headers=headers).status_code==422
    measurable=client.post("/habits",headers=headers,json={"name":"Water","daily_target":8,"target_unit":"glasses","color":"#159A9C"}).json()
    client.put(f"/habits/{measurable['id']}/progress",headers=headers,json={"recorded_value":4}).raise_for_status()
    activity=client.get(f"/habit-activity?days=84&habit_ids={measurable['id']}",headers=headers).json()["habits"][0]
    assert activity["color"]=="#159A9C" and activity["cells"][-1]["status"]=="partial" and activity["stats"]["partial"]==1
    assert client.get(f"/habit-activity?days=84&habit_ids={measurable['id']}",headers=other).status_code==404

def test_supported_habit_icon_is_saved_edited_and_validated():
    headers=register()
    created=client.post("/habits",headers=headers,json={"name":"Hydrate","icon":"water","color":"#159A9C"})
    assert created.status_code==201 and created.json()["icon"]=="water"
    edited=client.put(f"/habits/{created.json()['id']}",headers=headers,json={"name":"Hydrate","icon":"health","color":"#159A9C"})
    assert edited.status_code==200 and edited.json()["icon"]=="health"
    assert client.get("/habits",headers=headers).json()[0]["icon"]=="health"
    invalid=client.post("/habits",headers=headers,json={"name":"Bad icon","icon":"not-an-icon"})
    assert invalid.status_code==422

def test_calendar_separates_day_status_from_each_habit_identity_color():
    headers=register(); first=habit(headers,"Study"); second=client.post("/habits",headers=headers,json={"name":"Water","icon":"water","color":"#159A9C"}).json()
    client.post(f"/habits/{first['id']}/complete",headers=headers,json={}).raise_for_status()
    today=date.today(); cell=next(item for item in client.get(f"/calendar/{today.year}/{today.month}",headers=headers).json()["days"] if item["date"]==today.isoformat())
    assert cell["completed"]==1 and cell["scheduled"]==2
    assert {(item["name"],item["color"],item["status"]) for item in cell["activities"]}=={("Study",first["color"],"complete"),("Water","#159A9C","missed")}
    tomorrow=today+timedelta(days=1); future=next(item for item in client.get(f"/calendar/{tomorrow.year}/{tomorrow.month}",headers=headers).json()["days"] if item["date"]==tomorrow.isoformat())
    assert future["completed"]==0 and future["scheduled"]==0
    assert all(item["status"]=="upcoming" for item in future["activities"])

def test_demo_reset_preserves_real_habits_and_completions():
    headers=register(); real=habit(headers,"My real habit")
    client.post(f"/habits/{real['id']}/complete",headers=headers,json={}).raise_for_status()
    # Demo loading intentionally requires no existing completions, so use a real
    # habit without a check-in and verify it survives the sample-only reset.
    other=register("demo-safe@example.com"); genuine=habit(other,"Keep me")
    client.post("/demo/sample",headers=other).raise_for_status()
    client.request("DELETE","/demo/sample",headers=other).raise_for_status()
    remaining=client.get("/habits",headers=other).json()
    assert [item["id"] for item in remaining]==[genuine["id"]]

def test_invitation_creation_validation_registration_expiry_and_revocation():
    inviter=register("inviter@example.com",name="Ava Archer")
    created=client.post("/invites",headers=inviter)
    assert created.status_code==201 and created.json()["token"] not in str(client.get("/leaderboard",headers=inviter).json())
    token=created.json()["token"]
    inspected=client.get(f"/invites/{token}")
    assert inspected.status_code==200 and inspected.json()["inviter_display_name"]=="Ava A."
    joined=client.post("/auth/register",json={"name":"Ben","email":"joined@example.com","password":"password","invite_token":token})
    assert joined.status_code==200
    joined_headers={"Authorization":"Bearer "+joined.json()["token"]}
    assert client.get("/leaderboard",headers=joined_headers).json()["participating"] is False
    with SessionLocal() as session:
        assert session.query(Invitation).one().uses==1
    assert client.delete(f"/invites/{token}",headers=joined_headers).status_code==404
    assert client.delete(f"/invites/{token}",headers=inviter).status_code==204
    assert client.get(f"/invites/{token}").status_code==410
    assert client.post("/auth/register",json={"name":"Nope","email":"revoked@example.com","password":"password","invite_token":token}).status_code==410
    assert client.get("/invites/not-a-valid-token").status_code==410

def test_expired_invitation_is_rejected():
    inviter=register("expired-inviter@example.com"); token=client.post("/invites",headers=inviter).json()["token"]
    with SessionLocal() as session:
        invitation=session.query(Invitation).one(); invitation.expires_at=datetime(2000,1,1); session.commit()
    assert client.get(f"/invites/{token}").status_code==410
    assert client.post("/auth/register",json={"name":"Nope","email":"expired-join@example.com","password":"password","invite_token":token}).status_code==410
