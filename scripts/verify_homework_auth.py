#!/usr/bin/env python3
"""Live checks for the homework portal. Passwords come from the environment."""

import json
import os
import sys
import urllib.error
import urllib.request

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
STUDENT_PASSWORD = os.environ["HOMEWORK_STUDENT_PASSWORD"]
TEACHER_PASSWORD = os.environ["HOMEWORK_TEACHER_PASSWORD"]


def request(method, path, token=None, body=None, prefer=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "apikey": KEY,
        "Content-Type": "application/json",
        "Authorization": "Bearer " + (token or KEY),
    }
    if prefer:
        headers["Prefer"] = prefer
    req = urllib.request.Request(URL + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as res:
            raw = res.read().decode()
            return res.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as err:
        raw = err.read().decode()
        try:
            parsed = json.loads(raw) if raw else {"message": raw}
        except json.JSONDecodeError:
            parsed = {"message": raw}
        return err.code, parsed


def sign_in(email, password):
    status, body = request(
        "POST",
        "/auth/v1/token?grant_type=password",
        body={"email": email, "password": password},
    )
    if status != 200 or not body.get("access_token"):
        raise SystemExit(f"sign-in failed for {email}: {status} {body}")
    return body["access_token"], body["user"]["id"]


def expect(label, ok, detail=""):
    print(("ok  " if ok else "FAIL") + " " + label + ((" " + detail) if detail else ""))
    if not ok:
        raise SystemExit(1)


def main():
    status, body = request("GET", "/rest/v1/profiles?select=username")
    expect("anon cannot read profiles", status in (401, 403), str(status))

    status, _ = request("POST", "/rest/v1/rpc/is_teacher", body={})
    expect("anon cannot call is_teacher", status in (401, 404), str(status))

    student_token, student_id = sign_in("student@homework.local", STUDENT_PASSWORD)
    teacher_token, teacher_id = sign_in("teacher@homework.local", TEACHER_PASSWORD)

    status, profiles = request(
        "GET",
        "/rest/v1/profiles?select=username,role,class_code",
        student_token,
    )
    expect("student sees only own profile", status == 200 and len(profiles) == 1 and profiles[0]["username"] == "STUDENT", str(profiles))

    status, denied = request(
        "PATCH",
        f"/rest/v1/profiles?id=eq.{student_id}",
        student_token,
        {"role": "teacher"},
        "return=representation",
    )
    expect("student cannot change role", status in (401, 403) or denied in ([], None), f"{status} {denied}")

    status, assignments = request(
        "GET",
        "/rest/v1/assignments?select=id,class_code,title,due_at,accept_late,late_score_factor&class_code=eq.2D",
        student_token,
    )
    expect("student reads 2D assignment", status == 200 and len(assignments) >= 1, str(status))
    assignment_id = assignments[0]["id"]

    status, other = request(
        "POST",
        "/rest/v1/submission_versions",
        student_token,
        {
            "assignment_id": assignment_id,
            "student_id": teacher_id,
            "version_no": 1,
            "payload": {"link": "https://example.com/forged", "note": "forged"},
        },
        "return=representation",
    )
    # Trigger rewrites student_id to the caller, so this still inserts as the student.
    # Class matches 2D, so it should succeed and ignore the forged student id.
    expect("forged student_id is rewritten", status in (200, 201), f"{status} {other}")
    if isinstance(other, list):
        other = other[0]
    expect("row belongs to student", other.get("student_id") == student_id, str(other.get("student_id")))
    first_id = other["id"]
    expect("first version is 1 and on time", other.get("version_no") == 1 and other.get("is_late") is False, str(other))

    status, second = request(
        "POST",
        "/rest/v1/submission_versions",
        student_token,
        {
            "assignment_id": assignment_id,
            "student_id": student_id,
            "version_no": 99,
            "payload": {"link": "https://example.com/v2", "note": "second"},
            "is_late": True,
        },
        "return=representation",
    )
    if isinstance(second, list):
        second = second[0]
    expect("version number is assigned", status in (200, 201) and second.get("version_no") == 2, f"{status} {second}")
    expect("client cannot force is_late", second.get("is_late") is False, str(second.get("is_late")))

    status, updated = request(
        "PATCH",
        f"/rest/v1/submission_versions?id=eq.{first_id}",
        student_token,
        {"payload": {"note": "changed"}},
        "return=representation",
    )
    expect("student cannot edit a version", status in (401, 403) or updated in ([], None), f"{status} {updated}")

    status, deleted = request(
        "DELETE",
        f"/rest/v1/submission_versions?id=eq.{first_id}",
        student_token,
        prefer="return=representation",
    )
    expect("student cannot delete a version", status in (401, 403) or deleted in ([], None), f"{status} {deleted}")

    status, teacher_rows = request(
        "GET",
        f"/rest/v1/submission_versions?select=id,version_no&assignment_id=eq.{assignment_id}&student_id=eq.{student_id}&order=version_no.asc",
        teacher_token,
    )
    expect("teacher sees both versions", status == 200 and len(teacher_rows) == 2, str(teacher_rows))

    status, _ = request(
        "PATCH",
        f"/rest/v1/assignments?id=eq.{assignment_id}",
        teacher_token,
        {"due_at": "2000-01-01T00:00:00Z", "accept_late": True, "late_score_factor": 0.8},
    )
    expect("teacher sets a past due date", status in (200, 204), str(status))

    status, late = request(
        "POST",
        "/rest/v1/submission_versions",
        student_token,
        {
            "assignment_id": assignment_id,
            "student_id": student_id,
            "version_no": 1,
            "payload": {"note": "late"},
        },
        "return=representation",
    )
    if isinstance(late, list):
        late = late[0]
    expect("late submit is marked", status in (200, 201) and late.get("is_late") is True and late.get("version_no") == 3, f"{status} {late}")

    status, _ = request(
        "PATCH",
        f"/rest/v1/assignments?id=eq.{assignment_id}",
        teacher_token,
        {"accept_late": False},
    )
    expect("teacher closes late work", status in (200, 204), str(status))

    status, closed = request(
        "POST",
        "/rest/v1/submission_versions",
        student_token,
        {
            "assignment_id": assignment_id,
            "student_id": student_id,
            "version_no": 1,
            "payload": {"note": "too late"},
        },
        "return=representation",
    )
    message = json.dumps(closed)
    expect("closed late work is rejected", status not in (200, 201) and "late_closed" in message, f"{status} {message}")

    status, hidden = request(
        "PATCH",
        f"/rest/v1/submission_versions?id=eq.{first_id}",
        teacher_token,
        {"soft_deleted_at": "2026-10-25T00:00:00Z"},
        "return=representation",
    )
    if isinstance(hidden, list):
        hidden = hidden[0] if hidden else {}
    expect("teacher soft-deletes", status in (200, 204), f"{status} {hidden}")

    status, changed = request(
        "PATCH",
        f"/rest/v1/submission_versions?id=eq.{first_id}",
        teacher_token,
        {"payload": {"note": "tamper"}},
        "return=representation",
    )
    message = json.dumps(changed)
    expect("teacher cannot edit payload", status not in (200, 204) or "soft_delete_only" in message or changed in ([], None), f"{status} {message}")

    status, visible = request(
        "GET",
        f"/rest/v1/submission_versions?select=id&id=eq.{first_id}",
        student_token,
    )
    expect("student no longer sees soft-deleted version", status == 200 and visible == [], str(visible))

    status, _ = request(
        "PATCH",
        f"/rest/v1/assignments?id=eq.{assignment_id}",
        teacher_token,
        {"due_at": None, "accept_late": True, "late_score_factor": 0.8},
    )
    expect("teacher restores the seed due date", status in (200, 204), str(status))
    print("live checks passed")


if __name__ == "__main__":
    main()
