// Creates the tables if they do not exist and adds the columns the newer features need.
// Safe to run on every start: it never drops or rewrites existing data.

async function hasColumn(pool, table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]);
  return rows.length > 0;
}

async function ensureColumn(pool, table, column, definition) {
  if (!(await hasColumn(pool, table, column))) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`Added column ${table}.${column}`);
  }
}

async function initDatabase(pool) {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        index_no VARCHAR(20) UNIQUE NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) NOT NULL UNIQUE,
        password VARCHAR(255) NULL,
        role ENUM('admin', 'lecturer', 'student') NOT NULL,
        initials VARCHAR(10) NULL,
        department VARCHAR(100) NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS halls (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        capacity INT UNSIGNED NOT NULL,
        equipment JSON NOT NULL,
        status ENUM('active', 'inactive', 'maintenance') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subject_code VARCHAR(20) NOT NULL,
        subject_name VARCHAR(150) NOT NULL,
        department VARCHAR(100) NULL,
        lecturer_index VARCHAR(20) NULL,
        lecturer_id INT NULL,
        required_equipment JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS allocations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subject_id INT NOT NULL,
        hall_id INT NOT NULL,
        date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
        created_by INT NOT NULL,
        cancellation_reason VARCHAR(255) NULL,
        lecturer_index_no VARCHAR(20) NULL,
        subject_code VARCHAR(20) NULL,
        subject VARCHAR(150) NULL,
        hall VARCHAR(100) NULL,
        department VARCHAR(100) NULL,
        lecturer_name VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (end_time > start_time)
      )`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message VARCHAR(255) NOT NULL,
        status ENUM('read', 'unread') NOT NULL DEFAULT 'unread',
        type ENUM('success', 'warning', 'info', 'danger') NOT NULL DEFAULT 'info',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`);
    // Version 2: notifications for one user (NULL = all administrators)
    await ensureColumn(pool, 'notifications', 'user_email', 'VARCHAR(150) NULL');

    // Version 2: lecturer hall booking requests (SRS FR-46 to FR-55)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS booking_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        subject_id INT NOT NULL,
        requested_by INT NOT NULL,
        hall_id INT NULL,
        booking_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        students INT NOT NULL,
        equipment JSON NOT NULL,
        purpose VARCHAR(30) NOT NULL DEFAULT 'Regular lecture',
        status ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
        review_reason VARCHAR(255) NULL,
        reviewed_by INT NULL,
        allocation_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_booking_user (requested_by),
        INDEX idx_booking_status (status)
      )`);

    console.log('LHAS database tables are ready.');
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    throw err;
  }
}

module.exports = initDatabase;
