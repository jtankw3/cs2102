

const sql = {}

sql.query = {
	find_user: 'SELECT * FROM USERS',
	find_student: 'SELECT * FROM EnrolledStudents JOIN Users on sid = uid WHERE sid = $1',
	add_user: 'INSERT INTO users (uid, name, password) VALUES($1, $2, $3)',
	get_period: 'SELECT * FROM RegisterPeriods WHERE NOW() > s_time and NOW() < e_time;',
	allocated_students: 'SELECT * FROM Accept NATURAL JOIN EnrolledStudents'
	+ ' JOIN Users on sid = uid WHERE cid = $1 AND a_year = $2 AND semester = $3',
	delete_allocated_students: 'DELETE FROM Accept WHERE cid = $1 sid = $2',

	create_course:'INSERT INTO Courses (cid, quota, name, credit, c_admin) VALUES($1,$2,$3,$4,$5) ON CONFLICT(cid) DO UPDATE SET cid = $1, quota = $2, name = $3, credit = $4, c_admin = $5',
	view_course: 'SELECT * FROM Courses',
	delete_course: 'DELETE FROM Courses WHERE cid=?',

	create_prereq: 'INSERT INTO Prerequisites (required_cid, requiring_cid, setter) VALUES($1,$2,$3) ON CONFLICT(required_cid,requiring_cid) DO UPDATE SET required_cid = $1, requiring_cid = $2, setter = $3',
	view_prereq: 'SELECT * FROM Prerequisites',

	create_student: 'INSERT INTO EnrolledStudents (sid, name, e_year, dname1, dname2) VALUES ($1,$2,$3,$4,$5) ON CONFLICT(sid) DO UPDATE SET sid = $1, name = $2, e_year = $3, dname1 = $4, dname2 = $5',
	view_student: 'SELECT * FROM EnrolledStudents',

	create_admin: 'INSERT INTO Administrators(aid) VALUES($1) ON CONFLICT(aid) DO UPDATE SET aid = $1',
	view_admin: 'SELECT * FROM Administrators',
	edit_admin: 'DELETE FROM Accept WHERE cid = $1 sid = $2 CASCADE'
}



module.exports = sql
