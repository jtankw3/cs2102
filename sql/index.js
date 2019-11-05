/*const sql = {}

sql.query = {
	find_user: 'SELECT * FROM USERS',
	add_user: 'INSERT INTO users (uid, name, password) VALUES($1, $2, $3)',
	course_add:'INSERT INTO register (sid, cid) VALUES($1, $2)'
}

module.exports = sql*/

const sql = {}

sql.query = {
	find_user: 'SELECT * FROM USERS',
	add_user: 'INSERT INTO users (uid, name, password) VALUES($1, $2, $3)',

	create_course:'INSERT INTO Courses (cid, quota, name, credit, c_admin) VALUES($1,$2,$3,$4,$5) ON CONFLICT(cid) DO UPDATE SET cid = $1, quota = $2, name = $3, credit = $4, c_admin = $5',
	view_course: 'SELECT * FROM Courses',
	delete_course: 'DELETE FROM Courses WHERE cid=?',

	create_prereq: 'INSERT INTO Prerequisites (required_cid, requiring_cid, setter) VALUES($1,$2,$3) ON CONFLICT(required_cid,requiring_cid) DO UPDATE SET required_cid = $1, requiring_cid = $2, setter = $3',
	view_prereq: 'SELECT * FROM Prerequisites',

	create_student: 'INSERT INTO EnrolledStudents (sid, e_year, dname1, dname2) VALUES($1,$2,$3,$4)', //ON CONFLICT(sid) DO UPDATE SET sid = $1, e_year = $2, dname1 = $3, dname2 = $4',
	view_student: 'SELECT * FROM EnrolledStudents',

	create_admin: 'INSERT INTO Administrators(aid) VALUES($1) ON CONFLICT(aid) DO UPDATE SET aid = $1',
	view_admin: 'SELECT * FROM Administrators'
}

module.exports = sql
