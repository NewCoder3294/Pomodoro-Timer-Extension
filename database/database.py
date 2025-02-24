import sqlite3
import json
from datetime import datetime
from pathlib import Path

class PomodoroDatabase:
    def __init__(self):
        self.db_path = Path(__file__).parent / 'pomodoro.db'
        self.conn = None
        self.cursor = None
        self.initialize_database()

    def connect(self):
        """Establish database connection"""
        self.conn = sqlite3.connect(str(self.db_path))
        self.cursor = self.conn.cursor()

    def disconnect(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.conn = None
            self.cursor = None

    def initialize_database(self):
        """Create database tables if they don't exist"""
        self.connect()
        
        # Create tasks table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                completed BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Create settings table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                focus_time INTEGER DEFAULT 25,
                break_time INTEGER DEFAULT 5,
                cycles INTEGER DEFAULT 4,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Create sessions table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                duration INTEGER NOT NULL,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                date TEXT NOT NULL
            )
        ''')

        # Insert default settings if not exists
        self.cursor.execute('SELECT COUNT(*) FROM settings')
        if self.cursor.fetchone()[0] == 0:
            self.cursor.execute('''
                INSERT INTO settings (focus_time, break_time, cycles)
                VALUES (25, 5, 4)
            ''')

        self.conn.commit()
        self.disconnect()

    # Task operations
    def add_task(self, text):
        """Add a new task"""
        self.connect()
        try:
            self.cursor.execute('''
                INSERT INTO tasks (text)
                VALUES (?)
            ''', (text,))
            task_id = self.cursor.lastrowid
            self.conn.commit()
            return task_id
        finally:
            self.disconnect()

    def get_all_tasks(self):
        """Get all tasks"""
        self.connect()
        try:
            self.cursor.execute('''
                SELECT id, text, completed, created_at, updated_at
                FROM tasks
                ORDER BY created_at DESC
            ''')
            tasks = self.cursor.fetchall()
            return [{
                'id': task[0],
                'text': task[1],
                'completed': bool(task[2]),
                'created_at': task[3],
                'updated_at': task[4]
            } for task in tasks]
        finally:
            self.disconnect()

    def update_task(self, task_id, updates):
        """Update a task"""
        self.connect()
        try:
            set_clause = ', '.join([f"{k} = ?" for k in updates.keys()])
            query = f'''
                UPDATE tasks
                SET {set_clause}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            '''
            values = list(updates.values()) + [task_id]
            self.cursor.execute(query, values)
            self.conn.commit()
            return self.cursor.rowcount > 0
        finally:
            self.disconnect()

    def delete_task(self, task_id):
        """Delete a task"""
        self.connect()
        try:
            self.cursor.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
            self.conn.commit()
            return self.cursor.rowcount > 0
        finally:
            self.disconnect()

    # Settings operations
    def save_settings(self, settings):
        """Save user settings"""
        self.connect()
        try:
            self.cursor.execute('''
                UPDATE settings
                SET focus_time = ?,
                    break_time = ?,
                    cycles = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = 1
            ''', (settings['focus'], settings['break'], settings['cycles']))
            self.conn.commit()
            return True
        finally:
            self.disconnect()

    def get_settings(self):
        """Get user settings"""
        self.connect()
        try:
            self.cursor.execute('''
                SELECT focus_time, break_time, cycles
                FROM settings
                WHERE id = 1
            ''')
            settings = self.cursor.fetchone()
            if settings:
                return {
                    'focus': settings[0],
                    'break': settings[1],
                    'cycles': settings[2]
                }
            return None
        finally:
            self.disconnect()

    # Session operations
    def add_session(self, session_type, duration):
        """Add a completed session"""
        self.connect()
        try:
            current_date = datetime.now().strftime('%Y-%m-%d')
            self.cursor.execute('''
                INSERT INTO sessions (type, duration, date)
                VALUES (?, ?, ?)
            ''', (session_type, duration, current_date))
            self.conn.commit()
            return self.cursor.lastrowid
        finally:
            self.disconnect()

    def get_sessions_by_date(self, date):
        """Get sessions for a specific date"""
        self.connect()
        try:
            self.cursor.execute('''
                SELECT id, type, duration, completed_at
                FROM sessions
                WHERE date = ?
                ORDER BY completed_at DESC
            ''', (date,))
            sessions = self.cursor.fetchall()
            return [{
                'id': session[0],
                'type': session[1],
                'duration': session[2],
                'completed_at': session[3]
            } for session in sessions]
        finally:
            self.disconnect()

    def get_session_stats(self, start_date, end_date):
        """Get session statistics for a date range"""
        self.connect()
        try:
            self.cursor.execute('''
                SELECT 
                    type,
                    COUNT(*) as count,
                    SUM(duration) as total_duration
                FROM sessions
                WHERE date BETWEEN ? AND ?
                GROUP BY type
            ''', (start_date, end_date))
            stats = self.cursor.fetchall()
            return [{
                'type': stat[0],
                'count': stat[1],
                'total_duration': stat[2]
            } for stat in stats]
        finally:
            self.disconnect()
