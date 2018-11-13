import os
import time
import datetime

from flask import Flask, session, render_template, url_for, request, redirect, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename

UPLOAD_FOLDER = './uploads'
ALLOWED_EXTENSIONS = set(['txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif'])

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
socketio = SocketIO(app)

users = set()

channels = dict()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route("/", methods=["GET", "POST"])
def index():
	if request.method == "GET":
		return render_template("index.html", users=list(users), channels=list(channels.keys()))
	else: 
		user = request.form.get("user")
		if user in users:
			return jsonify({'success': False})
		else: 
			return jsonify({'success': True})

@app.route("/check_channel", methods=["POST"])
def check():
	channel = request.form.get('channel')
	if channel in channels:
		return jsonify({'success': False})
	else:
		return jsonify({'success': True})

@app.route("/channel/<channel>", methods=["GET", "POST"])
def open_channel(channel):
	if request.method == "GET":
		if channel not in channels:
			return jsonify({"Error": "That channel doesn't exist!"})
		else: 
			return render_template("channel.html", channel=channel, users=channels[channel]['users'])
	else:
		file = request.files['file']
		if allowed_file(file.filename):
			message = request.form['message']
			user = request.form['user']
			channel = request.form['channel']
			timestamp = request.form['timestamp']
			filename = secure_filename(file.filename)
			file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
			filepath = '/files/' + filename
			packet = {
				'channel': channel,
				'user': user, 
				'message': message, 
				'time': timestamp,
				'file': filepath
			}
			new_message(packet)
			return render_template("channel.html", 
				channel=channel, 
				users=channels[channel]['users'], 
				messages=channels[channel]['messages'])
		else:
			file_error = "This file type is not supported. Allowable extensions are .txt, .pdf, .png, .jpg, .jpeg, and .gif."
			return render_template("channel.html", channel=channel, users=channels[channel]['users'], messages=channels[channel]['messages'], submit_error=file_error)

@app.route("/files/<filename>")
def uploaded_file(filename):
	return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@socketio.on("user logged in")
def add_user(data):
	user = data['user']
	users.add(user)
	emit("users update", {'users': list(users)}, broadcast=True)
	emit("channels update", {'channels': channels}, broadcast=True)

@socketio.on("channel added")
def add_channel(data):
	channel_name = data['channel']
	channels[channel_name] = {
		'users': [data['user']],
		'messages': []
	}
	emit("channels update", {'channels': channels}, broadcast=True)

@socketio.on("channel opened")
def open_channel(data):
	channel = data['channel']
	emit('messages update', {'channel': channel, 'messages': channels[channel]['messages']}, broadcast=True)
			
@socketio.on("channel deleted")
def delete_channel(data):
	channel = data['channel']
	del channels[channel]
	emit("channels update", {'channels': channels}, broadcast=True)

@socketio.on("message added")
def add_message(data):
	new_message(data)
	emit('messages update', {'channel': data['channel'], 'messages': channels[data['channel']]['messages']}, broadcast=True)

@socketio.on('user logged off')
def log_off(data):
	user = data['user']
	if user in users: 
		users.remove(user)
	emit('users update', {'users': list(users)}, broadcast=True)

def new_message(data):
	channel = data['channel']
	message_dict = {}
	message_dict['channel'] = channel
	message_dict['user'] = data['user']
	message_dict['message'] = {'text': data['message']}
	if 'file' in data:
		message_dict['message']['file'] = data['file']
	message_dict['timestamp'] = data['time']
	if len(channels[channel]['messages']) >= 100:
		channels[channel]['message'].pop(0)
	channels[channel]['messages'].append(message_dict)

if __name__ == 'main':
	app.run()
