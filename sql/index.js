const sql = {}

sql.query = {
	find_user: 'SELECT * FROM USERS',
	find_student: 'SELECT * FROM EnrolledStudents JOIN Users on sid = uid WHERE sid = $1',

	add_user: 'INSERT INTO users (uid, name, password) VALUES($1, $2, $3)',
	get_period: 'SELECT * FROM RegisterPeriods WHERE NOW() > s_time and NOW() < e_time;',
	allocated_students: 'SELECT * FROM Accept NATURAL JOIN EnrolledStudents'
	+ ' JOIN Users on sid = uid WHERE cid = $1 AND a_year = $2 AND semester = $3;',
	delete_allocated_students: 'DELETE FROM Accept WHERE cid = $1 sid = $2;',


}

module.exports = sql
