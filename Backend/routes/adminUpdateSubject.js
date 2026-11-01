const express = require('express');
const router = express.Router();

const SUBJECT_DEPARTMENTS = ['Software Engineering', 'Data Science', 'Information Systems'];


router.post('/updateSubject', async (req, res) => {
  try {
    const s = req.body || {};


    if (!s.subject_code || !s.subject_name) {
      return res.status(400).json({ message: 'subject_code and subject_name are required' });
    }

    if (s.department && !SUBJECT_DEPARTMENTS.includes(s.department)) {
      return res.status(400).json({
        message: `department must be one of: ${SUBJECT_DEPARTMENTS.join(', ')}`
      });
    }


    const equipment = Array.isArray(s.required_equipment)
      ? JSON.stringify(s.required_equipment)
      : (typeof s.required_equipment === 'string' && s.required_equipment.trim()
          ? JSON.stringify(
              s.required_equipment
                .split(',')
                .map(x => x.trim())
                .filter(Boolean)
            )
          : '[]');


    const batchYear = s.batch_year === '' || s.batch_year === null || s.batch_year === undefined ? null : Number(s.batch_year);
    if (batchYear !== null && ![1, 2, 3, 4].includes(batchYear)) {
      return res.status(400).json({ message: 'Batch year must be 1, 2, 3 or 4' });
    }
    let lecturer_id = null;
    if (s.lecturer_index) {
      const [lecturerRows] = await req.pool.query(
        `SELECT id FROM users WHERE index_no = ? AND role = 'lecturer' LIMIT 1`,
        [s.lecturer_index]
      );
      if (!lecturerRows.length) {
        return res.status(400).json({
          message: `No lecturer found with index_no ${s.lecturer_index}`
        });
      }
      lecturer_id = lecturerRows[0].id;
    }


    if (s.id) {

      const [dup] = await req.pool.query(
        `SELECT id FROM subjects WHERE subject_code = ? AND id <> ? LIMIT 1`,
        [s.subject_code, s.id]
      );
      if (dup.length) {
        return res.status(409).json({ message: 'Subject code already exists' });
      }

      const [result] = await req.pool.query(
        `UPDATE subjects
            SET subject_code = ?, subject_name = ?, department = ?,
                lecturer_index = ?, lecturer_id = ?, required_equipment = ?, batch_year = ?
          WHERE id = ?`,
        [
          s.subject_code,
          s.subject_name,
          s.department ?? null,
          s.lecturer_index ?? null,
          lecturer_id,
          equipment,
          batchYear,
          s.id
        ]
      );

      if (!result.affectedRows) {
        return res.status(404).json({ message: 'Subject not found' });
      }

      return res.status(200).json({ message: 'Subject updated successfully', id: s.id });
    }


    if (!lecturer_id) {
      return res.status(400).json({
        message: 'A lecturer must be assigned to the subject'
      });
    }


    const [dup] = await req.pool.query(
      `SELECT id FROM subjects WHERE subject_code = ? LIMIT 1`,
      [s.subject_code]
    );
    if (dup.length) {
      return res.status(409).json({ message: 'Subject code already exists' });
    }

    const [result] = await req.pool.query(
      `INSERT INTO subjects
         (subject_code, subject_name, department, lecturer_index, lecturer_id, required_equipment, batch_year)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        s.subject_code,
        s.subject_name,
        s.department ?? null,
        s.lecturer_index ?? null,
        lecturer_id,
        equipment,
        batchYear
      ]
    );

    return res.status(200).json({ message: 'Subject added successfully', id: result.insertId });
  } catch (err) {
    console.error('updateSubject error:', err);
    return res.status(500).json({ message: 'Failed to save subject' });
  }
});

module.exports = router;