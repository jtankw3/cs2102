/* Negative Test Cases:
	add new degree: INSERT INTO Degrees VALUES('Nursing');
	add new requirement: INSERT INTO Requirements VALUES('Nursing', 'NN1010', 'core');
	add without prereq: INSERT INTO Register VALUES(2019, 1, 3, 'A1000009Z', 'CS1025');
	add clashing exams: INSERT INTO Register VALUES(2019, 1, 3, 'A1000002Z', 'CS1014');
	add more than 7 mods: INSERT INTO Register VALUES(2019, 1, 3, 'A1000003Z', 'CS1019');
	add more than 7 mods: INSERT INTO Register VALUES(2019, 1, 3, 'A1000003Z', 'CS1018');
	complex query for priority: use CS1017 which has quota 5 but 6 registers
	*/

DROP TABLE IF EXISTS Users CASCADE;

DROP TABLE IF EXISTS Administrators CASCADE;
CREATE TABLE Administrators(
	aid varchar(20) PRIMARY KEY,
	name varchar(50) NOT NULL,
	password varchar(60) DEFAULT 'password$789'
);

DROP TABLE IF EXISTS Courses CASCADE;
CREATE TABLE Courses(
	cid varchar(7) PRIMARY KEY,
	name varchar(50) NOT NULL,
	quota integer NOT NULL,
	credits integer NOT NULL,
	c_admin varchar(20) NOT NULL,
	FOREIGN KEY(c_admin) REFERENCES Administrators(aid)
);

DROP TABLE IF EXISTS Prerequisites CASCADE;
CREATE TABLE Prerequisites(
	required_cid varchar(7),
	requiring_cid varchar(7),
	setter varchar(20) NOT NULL,
	PRIMARY KEY(required_cid, requiring_cid),
	FOREIGN KEY(required_cid) REFERENCES Courses(cid),
	FOREIGN KEY(requiring_cid) REFERENCES Courses(cid),
	FOREIGN KEY(setter) REFERENCES Administrators(aid)
);

/* Total participation constraint enforced with triggers */
DROP TABLE IF EXISTS Degrees CASCADE;
CREATE TABLE Degrees(
	name varchar(50) PRIMARY KEY
);

DROP TABLE IF EXISTS Requirements CASCADE;
CREATE TABLE Requirements(
	name varchar(50),
	required_cid varchar(7),
	type varchar(50) NOT NULL,
	PRIMARY KEY(name, required_cid),
	FOREIGN KEY(name) REFERENCES Degrees(name) DEFERRABLE INITIALLY DEFERRED,
	FOREIGN KEY(required_cid) REFERENCES Courses(cid)
);

DROP TABLE IF EXISTS EnrolledStudents CASCADE;
CREATE TABLE EnrolledStudents(
	sid varchar(20) PRIMARY KEY,
	name varchar(50) NOT NULL,
	password varchar(60) DEFAULT 'password$123',
	e_year integer NOT NULL,
	dname1 varchar(20) NOT NULL,
	dname2 varchar(20),
	FOREIGN KEY(dname1) REFERENCES Degrees(name),
	FOREIGN KEY(dname2) REFERENCES Degrees(name)
);

DROP TABLE IF EXISTS RegisterPeriods CASCADE;
CREATE TABLE RegisterPeriods(
	a_year integer,
	semester integer,
	round integer,
	s_time timestamp,
	e_time timestamp,
	PRIMARY KEY(a_year, semester, round),
	CHECK(s_time < e_time)
);

DROP TABLE IF EXISTS Register CASCADE;
CREATE TABLE Register(
	a_year integer,
	semester integer,
	round integer,
	sid varchar(20),
	cid varchar(7),
	PRIMARY KEY(a_year, semester, round, cid, sid),
  	FOREIGN KEY(a_year, semester, round) REFERENCES RegisterPeriods(a_year, semester, round),
	FOREIGN KEY(sid) REFERENCES EnrolledStudents(sid),
	FOREIGN KEY(cid) REFERENCES Courses(cid)
);

DROP TABLE IF EXISTS Accept CASCADE;
CREATE TABLE Accept(
	sid varchar(20),
	cid varchar(7),
	a_year integer,
  	semester integer,
	PRIMARY KEY(sid, cid),
	FOREIGN KEY(sid) REFERENCES EnrolledStudents(sid),
	FOREIGN KEY(cid) REFERENCES Courses(cid)
);

DROP TABLE IF EXISTS Taken CASCADE;
CREATE TABLE Taken(
	sid varchar(20),
	cid varchar(7),
	PRIMARY KEY(sid, cid),
	FOREIGN KEY(sid) REFERENCES EnrolledStudents(sid),
	FOREIGN KEY(cid) REFERENCES Courses(cid)
);

DROP TABLE IF EXISTS FinalExams CASCADE;
CREATE TABLE FinalExams(
	cid varchar(7),
	s_time timestamp,
	e_time timestamp,
	venue varchar(100) NOT NULL,
	PRIMARY KEY(cid),
	FOREIGN KEY(cid) REFERENCES Courses(cid) ON DELETE cascade,
	CHECK(s_time < e_time)
);

/* Total participation constraint for degree requirements */
CREATE OR REPLACE FUNCTION deg_func()
	RETURNS TRIGGER AS $$ BEGIN
	IF EXISTS (
		SELECT name
		FROM Requirements
		WHERE name = NEW.name)
	THEN RETURN NEW;
	ELSE RAISE NOTICE
		'Cannot add degree without requirements';
		RETURN NULL;
	END IF;
	END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deg_trig ON Degrees;
CREATE TRIGGER deg_trig
BEFORE INSERT OR UPDATE ON Degrees
	FOR EACH ROW
	EXECUTE FUNCTION deg_func();

CREATE OR REPLACE PROCEDURE add_requirements (
	dname 					varchar(50),
	required_cid 	varchar(7),
	type 					varchar(50)) AS
'BEGIN
	INSERT INTO Requirements VALUES (dname, required_cid, type);
	IF NOT EXISTS (SELECT 1 FROM Degrees WHERE name = dname)
	THEN INSERT INTO Degrees VALUES (dname);
	END IF;
	END;'
LANGUAGE plpgsql;

/* Trigger for final exam clash checking */
CREATE OR REPLACE FUNCTION exam_clashes()
RETURNS TRIGGER AS $$ BEGIN
	IF EXISTS (SELECT 1 FROM FinalExams F1
		JOIN FinalExams F2
		ON (F1.s_time >= F2.s_time AND F1.s_time < F2.e_time
		OR F1.e_time > F2.s_time AND F1.e_time <= F2.e_time)
		AND F1.cid <> F2.cid
		WHERE F1.cid = NEW.cid AND (
		F2.cid in (
			SELECT cid
			FROM Accept A
			WHERE A.sid = NEW.sid
				AND A.a_year = NEW.a_year
				AND A.semester = NEW.semester)
		OR F2.cid in (
			SELECT cid
			FROM Register R
			WHERE R.sid = NEW.sid
				AND R.a_year = NEW.a_year
				AND R.semester = NEW.semester
				AND R.round = NEW.round)))
		THEN
		RAISE NOTICE 'Course selected have clashing examinations';
		RETURN NULL;
		ELSE RETURN NEW;
		END IF;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exam_clash ON Register;
CREATE TRIGGER exam_clash
BEFORE INSERT OR UPDATE ON Register
FOR EACH ROW
EXECUTE PROCEDURE exam_clashes();

/* Trigger for Prerequisites fulfilment checking */
CREATE OR REPLACE FUNCTION prereq()
	RETURNS TRIGGER AS $$ BEGIN
	IF EXISTS (
			SELECT required_cid AS prereq
			FROM Prerequisites
			WHERE requiring_cid = NEW.cid
			EXCEPT
			SELECT cid
			FROM Taken
			WHERE sid = NEW.sid)
	THEN RAISE NOTICE 'Prerequisite not fulfilled';
	RETURN NULL;
	ELSE RETURN NEW;
	END IF;
	END; $$ LANGUAGE plpgsql;

CREATE TRIGGER pre_req
	BEFORE INSERT OR UPDATE ON Register
	FOR EACH ROW
	EXECUTE PROCEDURE prereq();

	/* Trigger for Max modules */
		CREATE OR REPLACE FUNCTION max_modules()
		RETURNS TRIGGER AS $$ BEGIN
		IF (SELECT COUNT(*) FROM Register
			WHERE a_year = new.a_year
			AND round = new.round
			AND sid = new.sid) > 6
		THEN RAISE NOTICE 'Module Limit Exceeded';
		RETURN NULL;
		ELSE RETURN NEW;
		END IF;
		END; $$ LANGUAGE plpgsql;

		CREATE TRIGGER max_modules
		BEFORE INSERT OR UPDATE ON Register
		FOR EACH ROW
		EXECUTE PROCEDURE max_modules();

/* use A1000001Z - A1000005Z for testing, A1000003Z has taken all prereq */
INSERT INTO Administrators VALUES('B1000001X', 'Administrator1', 'password1');
INSERT INTO Administrators VALUES('B1000002X', 'Administrator2', 'password2');
INSERT INTO Administrators VALUES('B1000003X', 'Administrator3', 'password3');
INSERT INTO Administrators VALUES('B1000004X', 'Administrator4', 'password4');
INSERT INTO Administrators VALUES('B1000005X', 'Administrator5', 'password5');


/* Used smaller quota for testing */
INSERT INTO Courses VALUES('CS1010', 'Programming', 5, 4, 'B1000001X');
INSERT INTO Courses VALUES('CS1011', 'Programming2', 5, 4, 'B1000001X');
INSERT INTO Courses VALUES('CS1012', 'Programming3', 5, 4, 'B1000002X');
INSERT INTO Courses VALUES('CS1013', 'Programming4', 10, 4, 'B1000002X');
INSERT INTO Courses VALUES('CS1014', 'Programming5', 20, 4, 'B1000002X');
INSERT INTO Courses VALUES('CS1015', 'Programming6', 20, 4, 'B1000002X');
INSERT INTO Courses VALUES('CS1016', 'Programming7', 30, 4, 'B1000004X');
INSERT INTO Courses VALUES('CS1017', 'Programming8', 5, 4, 'B1000004X');
INSERT INTO Courses VALUES('CS1018', 'Programming9', 5, 4, 'B1000001X');
INSERT INTO Courses VALUES('CS1019', 'Programming10', 5, 4, 'B1000001X');
INSERT INTO Courses VALUES('CS1020', 'Programming11', 5, 4, 'B1000002X');
INSERT INTO Courses VALUES('CS1021', 'Programming12', 10, 4, 'B1000002X');
INSERT INTO Courses VALUES('CS1022', 'Programming13', 20, 4, 'B1000002X');
INSERT INTO Courses VALUES('CS1023', 'Programming14', 20, 4, 'B1000002X');
INSERT INTO Courses VALUES('CS1024', 'Programming15', 30, 4, 'B1000004X');
INSERT INTO Courses VALUES('CS1025', 'Programming16', 5, 4, 'B1000004X');
INSERT INTO Courses VALUES('GET1017', 'General1', 5, 4, 'B1000004X');
INSERT INTO Courses VALUES('GET1018', 'General2', 5, 4, 'B1000004X');

/* adds into degree list and requirements list */
CALL add_requirements('Computer Science', 'CS1010', 'core');
CALL add_requirements('Computer Science', 'CS1011', 'core');
CALL add_requirements('Computer Engineering', 'CS1012', 'core');
CALL add_requirements('Computer Engineering', 'CS1013', 'core');
CALL add_requirements('Computer Engineering', 'CS1017', 'core');
CALL add_requirements('Information Systems', 'CS1014', 'core');
CALL add_requirements('Information Systems', 'CS1015', 'core');
CALL add_requirements('Information Systems', 'GET1017', 'general');

/* Varying priority */
INSERT INTO EnrolledStudents VALUES('A1000001Z', 'Student1', 'password1', 2015, 'Computer Engineering', 'Computer Science');
INSERT INTO EnrolledStudents VALUES('A1000002Z', 'Student2', 'password2', 2016, 'Information Systems', null);
INSERT INTO EnrolledStudents VALUES('A1000003Z', 'Student3', 'password3', 2017, 'Computer Science', null);
INSERT INTO EnrolledStudents VALUES('A1000004Z', 'Student4', 'password4', 2018, 'Computer Engineering', null);
INSERT INTO EnrolledStudents VALUES('A1000005Z', 'Student5', 'password5', 2014, 'Information Systems', 'Computer Engineering');
INSERT INTO EnrolledStudents VALUES('A1000006Z', 'Student6', 'password6', 2015, 'Computer Science', null);
INSERT INTO EnrolledStudents VALUES('A1000007Z', 'Student7', 'password7', 2016, 'Computer Engineering', null);
INSERT INTO EnrolledStudents VALUES('A1000008Z', 'Student8', 'password8', 2017, 'Information Systems', null);
INSERT INTO EnrolledStudents VALUES('A1000009Z', 'Student9', 'password9', 2018, 'Computer Science', null);
INSERT INTO EnrolledStudents VALUES('A1000010Z', 'Student10', 'password10', 2014, 'Computer Engineering', null);
INSERT INTO EnrolledStudents VALUES('A1000011Z', 'Student11', 'password11', 2015, 'Information Systems', null);
INSERT INTO EnrolledStudents VALUES('A1000012Z', 'Student12', 'password12', 2016, 'Computer Science', null);
INSERT INTO EnrolledStudents VALUES('A1000013Z', 'Student13', 'password13', 2017, 'Computer Engineering', null);
INSERT INTO EnrolledStudents VALUES('A1000014Z', 'Student14', 'password14', 2018, 'Information Systems', null);
INSERT INTO EnrolledStudents VALUES('A1000015Z', 'Student15', 'password15', 2014, 'Computer Science', 'Computer Engineering');
INSERT INTO EnrolledStudents VALUES('A1000016Z', 'Student16', 'password16', 2015, 'Computer Engineering', 'Information Systems');
INSERT INTO EnrolledStudents VALUES('A1000017Z', 'Student17', 'password17', 2016, 'Information Systems', null);
INSERT INTO EnrolledStudents VALUES('A1000018Z', 'Student18', 'password18', 2017, 'Computer Science', null);
INSERT INTO EnrolledStudents VALUES('A1000019Z', 'Student19', 'password19', 2018, 'Computer Engineering', null);
INSERT INTO EnrolledStudents VALUES('A1000020Z', 'Student20', 'password20', 2014, 'Information Systems', 'Computer Science');

/* Longer date range for 2019 sem 1 round 3 for testing */
INSERT INTO RegisterPeriods VALUES(2018, 2, 1, '2018-08-10 14:00:00', '2018-08-15 18:00:00');
INSERT INTO RegisterPeriods VALUES(2018, 2, 2, '2018-08-20 09:00:00', '2018-08-30 18:00:00');
INSERT INTO RegisterPeriods VALUES(2018, 2, 3, '2018-09-10 09:00:00', '2018-09-20 18:00:00');
INSERT INTO RegisterPeriods VALUES(2018, 1, 1, '2019-08-10 14:00:00', '2019-08-15 18:00:00');
INSERT INTO RegisterPeriods VALUES(2019, 1, 2, '2019-08-20 09:00:00', '2019-08-30 18:00:00');
INSERT INTO RegisterPeriods VALUES(2019, 1, 3, '2019-09-10 09:00:00', '2019-12-20 18:00:00');

INSERT INTO Prerequisites VALUES('CS1011', 'CS1014', 'B1000001X');
INSERT INTO Prerequisites VALUES('CS1011', 'CS1015', 'B1000001X');
INSERT INTO Prerequisites VALUES('CS1011', 'CS1016', 'B1000001X');
INSERT INTO Prerequisites VALUES('CS1012', 'CS1013', 'B1000001X');
INSERT INTO Prerequisites VALUES('CS1012', 'CS1016', 'B1000001X');
INSERT INTO Prerequisites VALUES('CS1015', 'CS1021', 'B1000001X');
INSERT INTO Prerequisites VALUES('CS1015', 'CS1022', 'B1000001X');
INSERT INTO Prerequisites VALUES('CS1015', 'CS1023', 'B1000001X');
INSERT INTO Prerequisites VALUES('CS1017', 'CS1024', 'B1000001X');
INSERT INTO Prerequisites VALUES('CS1017', 'CS1025', 'B1000001X');

/* Clashing: (CS1010, CS1014), (CS1012, CS1014) and (GET1017, CS1017) */
INSERT INTO FinalExams VALUES('CS1010', '2019-12-10 14:00:00', '2019-12-10 16:00:00', 'MPSH1');
INSERT INTO FinalExams VALUES('CS1011', '2019-12-12 16:00:00', '2019-12-12 18:00:00', 'MPSH1');
INSERT INTO FinalExams VALUES('CS1012', '2019-12-10 16:00:00', '2019-12-10 18:00:00', 'MPSH1');
INSERT INTO FinalExams VALUES('CS1013', '2019-12-11 16:00:00', '2019-12-11 18:00:00', 'MPSH1');
INSERT INTO FinalExams VALUES('CS1014', '2019-12-10 15:00:00', '2019-12-10 17:00:00', 'MPSH1');
INSERT INTO FinalExams VALUES('CS1015', '2019-12-12 08:00:00', '2019-12-12 10:00:00', 'MPSH1');
INSERT INTO FinalExams VALUES('CS1016', '2019-12-12 20:00:00', '2019-12-12 22:00:00', 'MPSH1');
INSERT INTO FinalExams VALUES('CS1017', '2019-12-13 16:00:00', '2019-12-13 18:00:00', 'MPSH1');
INSERT INTO FinalExams VALUES('GET1017', '2019-12-13 16:00:00', '2019-12-13 18:00:00', 'MPSH1');
INSERT INTO FinalExams VALUES('GET1018', '2019-12-14 16:00:00', '2019-12-14 18:00:00', 'MPSH1');

INSERT INTO Taken VALUES('A1000001Z', 'CS1011');
INSERT INTO Taken VALUES('A1000001Z', 'CS1012');
INSERT INTO Taken VALUES('A1000002Z', 'CS1011');
INSERT INTO Taken VALUES('A1000002Z', 'CS1012');
INSERT INTO Taken VALUES('A1000003Z', 'CS1011');
INSERT INTO Taken VALUES('A1000003Z', 'CS1012');
INSERT INTO Taken VALUES('A1000003Z', 'CS1015');
INSERT INTO Taken VALUES('A1000003Z', 'CS1017');
INSERT INTO Taken VALUES('A1000004Z', 'CS1011');
INSERT INTO Taken VALUES('A1000004Z', 'CS1012');
INSERT INTO Taken VALUES('A1000005Z', 'CS1011');
INSERT INTO Taken VALUES('A1000005Z', 'CS1012');
INSERT INTO Taken VALUES('A1000006Z', 'CS1011');
INSERT INTO Taken VALUES('A1000006Z', 'CS1012');

INSERT INTO Register VALUES(2018, 2, 1, 'A1000001Z', 'CS1010');
INSERT INTO Register VALUES(2018, 2, 2, 'A1000001Z', 'CS1011');
INSERT INTO Register VALUES(2018, 2, 3, 'A1000001Z', 'CS1013');
INSERT INTO Register VALUES(2018, 2, 3, 'A1000001Z', 'CS1014');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000001Z', 'CS1015');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000001Z', 'CS1016');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000001Z', 'CS1017');
INSERT INTO Register VALUES(2019, 1, 2, 'A1000001Z', 'CS1015');
INSERT INTO Register VALUES(2019, 1, 2, 'A1000001Z', 'CS1016');
INSERT INTO Register VALUES(2019, 1, 2, 'A1000001Z', 'CS1017');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000002Z', 'CS1012');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000002Z', 'CS1013');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000002Z', 'CS1015');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000002Z', 'CS1016');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000002Z', 'CS1017');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000003Z', 'CS1020');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000003Z', 'CS1021');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000003Z', 'CS1022');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000003Z', 'CS1023');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000003Z', 'CS1024');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000003Z', 'CS1025');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000004Z', 'CS1013');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000004Z', 'CS1014');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000004Z', 'CS1015');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000004Z', 'CS1016');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000004Z', 'CS1017');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000005Z', 'CS1012');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000005Z', 'CS1013');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000005Z', 'CS1015');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000005Z', 'CS1016');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000005Z', 'CS1017');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000006Z', 'CS1013');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000006Z', 'CS1014');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000006Z', 'CS1015');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000006Z', 'CS1016');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000006Z', 'CS1017');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000007Z', 'CS1011');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000007Z', 'CS1012');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000008Z', 'CS1011');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000008Z', 'CS1012');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000009Z', 'CS1011');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000009Z', 'CS1012');
INSERT INTO Register VALUES(2019, 1, 3, 'A1000011Z', 'CS1017');

INSERT INTO Accept VALUES('A1000001Z', 'CS1012', 2019, 1);
INSERT INTO Accept VALUES('A1000001Z', 'CS1013', 2019, 1);
INSERT INTO Accept VALUES('A1000001Z', 'CS1014', 2019, 1);
INSERT INTO Accept VALUES('A1000001Z', 'CS1017', 2019, 1);
