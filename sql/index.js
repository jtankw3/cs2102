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
	add_user: 'INSERT INTO users (uid, name, password) VALUES($1, $2, $3)'
}

module.exports = sql
