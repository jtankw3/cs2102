

const sql = {}

sql.query = {
	find_student: 'SELECT * FROM EnrolledStudents WHERE sid = $1',
	get_period: 'SELECT * FROM RegisterPeriods WHERE NOW() > s_time and NOW() < e_time;',
	allocated_students: 'SELECT * FROM Accept NATURAL JOIN EnrolledStudents'
	+ ' WHERE cid = $1 AND a_year = $2 AND semester = $3',
	delete_allocated_student: 'DELETE FROM Accept WHERE cid = $1 AND sid = $2',
	add_allocated_student: 'INSERT INTO Accept(sid, cid, a_year, semester) VALUES($1, $2, $3, $4)',

	create_course:'INSERT INTO Courses (cid, name, quota, credits, c_admin) VALUES($1,$2,$3,$4,$5) ON CONFLICT(cid) DO UPDATE SET cid = $1, name = $2, quota = $3, credits = $4, c_admin = $5',
	view_course: 'SELECT C.cid, C.name, C.quota, C.credits, C.c_admin, F.s_time FROM Courses C FULL JOIN Finalexams F ON C.cid = F.cid',
	delete_course: 'DELETE FROM Courses WHERE cid=$1', //CASCADE',

	create_prereq: 'INSERT INTO Prerequisites (required_cid, requiring_cid, setter) VALUES($1,$2,$3) ON CONFLICT(required_cid,requiring_cid) DO UPDATE SET required_cid = $1, requiring_cid = $2, setter = $3',
	view_prereq: 'SELECT * FROM Prerequisites',
	delete_prereqs: 'DELETE FROM Prerequisites WHERE required_cid = $1 AND requiring_cid = $2',

	create_student: 'INSERT INTO EnrolledStudents (sid, name, e_year, dname1, dname2) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(sid) DO UPDATE SET sid = $1, name = $2, e_year = $3, dname1 = $4, dname2 = $5',
	view_student: 'SELECT * FROM EnrolledStudents',
	drop_students: 'DELETE FROM EnrolledStudents WHERE sid = $1',

	create_admin: 'INSERT INTO Administrators(aid,name) VALUES($1,$2) ON CONFLICT(aid) DO UPDATE SET aid = $1, name = $2',
	view_admin: 'SELECT * FROM Administrators',
	delete_admins: 'DELETE FROM Administrators WHERE aid = $1',
	add_exam: 'INSERT INTO FinalExams VALUES($1,$2,$3,$4)',

	calculate_priority: "With CoreReq AS (SELECT * FROM Requirements WHERE type = 'core' and required_cid = $1), "
	+ "RemainingQuota as (SELECT quota - (SELECT COUNT(*) FROM Accept WHERE cid = $1 "
	+ "AND a_year=$2 and semester = $3) "
	+ "FROM Courses WHERE cid = $1) "
	+ "SELECT E1.sid, (COALESCE((SELECT 2 FROM CoreReq WHERE name = E1.dname1), "
	+ "(SELECT 1 FROM CoreReq WHERE name = E1.dname2), 0) + "
	+ "(SELECT COUNT(*) FROM Accept WHERE sid = E1.sid AND a_year = 2019 AND semester = 1) - "
	+ "(SELECT e_year FROM EnrolledStudents E2 WHERE E2.sid = E1.sid)) AS Priority "
	+ "FROM (SELECT * FROM Register WHERE (sid, cid) not in (select sid, cid from accept)) R1 NATURAL JOIN EnrolledStudents E1 "
	+ "WHERE R1.cid = $1 AND a_year = $2 AND semester = $3 AND round = $4 "
	+ "ORDER BY Priority DESC, RANDOM() "
	+ "LIMIT (SELECT * FROM RemainingQuota)",

	view_register: "SELECT R.cid, C.name, C.credits FROM register R JOIN courses C "
	+ "ON R.cid = C.cid WHERE a_year=$1 AND semester=$2 AND round = $3"
	+ "AND sid = $4",
	create_register: "INSERT INTO register(a_year, semester, round, sid, cid) "
	+ "VALUES($1, $2, $3, $4, $5)",
	delete_register: 'DELETE FROM Register WHERE cid = $1 AND sid = $2 '
	+ "AND a_year = $3 AND semester =$4 and round=$5",

	view_accept: "SELECT A.cid, C.name, C.credits FROM Accept A JOIN Courses C "
	+ "ON A.cid = C.cid WHERE A.sid =$1",
	view_taken: "SELECT A.cid, C.name FROM Taken A JOIN Courses "
	+ "C ON A.cid = C.cid WHERE A.sid = $1",
	drop_accept: "DELETE FROM accept WHERE sid =$1 and cid =$2",

	search_prereq: "SELECT * FROM Prerequisites JOIN Courses ON requiring_cid "
	+ "= cid WHERE requiring_cid = $1",
	view_requirements: "SELECT required_cid, type FROM requirements WHERE name = $1",

	get_degrees: "SELECT dname1, dname2 FROM EnrolledStudents where sid=$1",

	check_apw: "SELECT password FROM Administrators where aid = $1 AND password = $2",
	update_apw: "UPDATE Administrators SET password = $1 WHERE aid = $2",

	check_spw: "SELECT password FROM EnrolledStudents where sid = $1 AND password = $2",
	update_spw: "UPDATE EnrolledStudents SET password = $1 WHERE sid = $2"
}

module.exports = sql
