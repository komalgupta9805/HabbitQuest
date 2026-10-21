from datetime import date, timedelta
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
def test_calendar_and_date_specific_history():
    h=register(); item=habit(h); yesterday=date.today()-timedelta(days=1)
    session=SessionLocal(); session.query(Habit).filter_by(id=item["id"]).update({"created_on":yesterday}); session.commit(); session.close()
    client.post(f"/habits/{item['id']}/complete",headers=h,json={"completed_on":yesterday.isoformat()})
    day=client.get(f"/days/{yesterday.isoformat()}",headers=h).json()
    assert day["completed"]==1 and day["habits"][0]["done"]
    month=client.get(f"/calendar/{yesterday.year}/{yesterday.month}",headers=h).json()
    assert any(x["date"]==yesterday.isoformat() and x["completed"]==1 for x in month["days"])
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
