from flask import Flask, request, jsonify
from flask_cors import CORS
from database import PomodoroDatabase
from datetime import datetime

app = Flask(__name__)
CORS(app)
db = PomodoroDatabase()

# Task routes
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    try:
        tasks = db.get_all_tasks()
        return jsonify(tasks)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks', methods=['POST'])
def add_task():
    try:
        data = request.json
        task_id = db.add_task(data['text'])
        return jsonify({'id': task_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    try:
        updates = request.json
        success = db.update_task(task_id, updates)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    try:
        success = db.delete_task(task_id)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Settings routes
@app.route('/api/settings', methods=['GET'])
def get_settings():
    try:
        settings = db.get_settings()
        return jsonify(settings)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings', methods=['POST'])
def save_settings():
    try:
        settings = request.json
        success = db.save_settings(settings)
        return jsonify({'success': success})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Session routes
@app.route('/api/sessions', methods=['POST'])
def add_session():
    try:
        data = request.json
        session_id = db.add_session(data['type'], data['duration'])
        return jsonify({'id': session_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions/<date>', methods=['GET'])
def get_sessions(date):
    try:
        sessions = db.get_sessions_by_date(date)
        return jsonify(sessions)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/sessions/stats', methods=['GET'])
def get_session_stats():
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date', datetime.now().strftime('%Y-%m-%d'))
        stats = db.get_session_stats(start_date, end_date)
        return jsonify(stats)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5000)
