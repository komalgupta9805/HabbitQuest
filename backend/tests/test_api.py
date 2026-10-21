from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import importlib
import os
os.environ["HABITQUEST_DATABASE_URL"] = "sqlite:///./habitquest-test.db"
import pytest
from fastapi.testclient import TestClient
from app.main import app, Base, engine, SessionLocal, Habit

client = TestClient(app)
@pytest.fixture(autouse=True)
def clean_database():
    Base.metadata.drop_all(engine); Base.metadata.create_all(engine)
def register(email="a@example.com"):
    response=client.post("/auth/register",json={"name":"Ava","email":email,"password":"password"})
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
    assert client.post(f"/habits/{item['id']}/complete",headers=h,json={}).json()["xp"]==60
    assert client.post(f"/habits/{item['id']}/complete",headers=h,json={}).status_code==409
    assert client.request("DELETE",f"/habits/{item['id']}/complete",headers=h,json={}).json()["xp"]==0
def test_dashboard_real_quest_bonus_heatmap_and_achievement():
    h=register(); first=habit(h,"Read"); second=habit(h,"Move")
    client.post(f"/habits/{first['id']}/complete",headers=h,json={})
    state=client.get("/dashboard",headers=h).json()
    assert state["today"]["completed"]==1 and state["today"]["total"]==2
    assert state["user"]["xp"]==20 and state["achievements"][0]["unlocked_on"]
    client.post(f"/habits/{second['id']}/complete",headers=h,json={})
    state=client.get("/dashboard",headers=h).json()
    assert state["today"]["bonus_claimed"] and state["user"]["xp"]==80
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
    assert dashboard["overall_streak"]==0 and dashboard["overall_longest_streak"]==3
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
