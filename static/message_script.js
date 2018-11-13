const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

document.addEventListener('DOMContentLoaded', () => {
	let socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port)
	socket.on('connect', () => {
		let channel = document.title
		socket.emit('channel opened', {'channel': channel})
		scrollToBottom()
		//add a hidden input to pass the name of the user to the form
		let i = document.createElement('input')
		i.setAttribute('type', 'hidden')
		i.setAttribute('value', localStorage.getItem('user'))
		i.setAttribute('name', 'user')
		let form = document.querySelector("#message-form")
		form.appendChild(i)
		let channels = JSON.parse(localStorage.getItem('channels'))
		//add name of channel to list in local storage
		if (!channels.includes(channel)) {
			channels = [...channels, document.title]
			localStorage.setItem('channels', JSON.stringify(channels))
		}
		//configure message submit button when a file is uploaded or when a message is typed
		document.querySelector("#file").onchange = () => {
			configureSendButton()
		}
		document.querySelector('#text').onkeyup = (event) => {
			configureSendButton()
			if (event.keyCode === 13) {
				console.log('hit enter')
				document.querySelector('#message-button').click()
			}
		}
		document.querySelector('#message-form').onsubmit = (event) => {
			document.querySelector("#timestamp").value = getDateAsString()
			let message = document.getElementById("text").value
			let channel = document.title
			let timestamp = document.querySelector("#timestamp").value
			let packet = {
				'channel': channel,
				'user': localStorage.getItem('user'), 
				'message': message, 
				'time': timestamp
			}
			//if no file has been uploaded, update messages via socket
			if (!document.getElementById('file').files[0]) {
				event.preventDefault()
				socket.emit('message added', packet)
				afterSending()
				return false
			} 
		}
	})
	socket.on('messages update', data => {
		let channel = document.title
		if (channel === data['channel']) {
			let messageDiv = document.querySelector("#message-div")
			while (messageDiv.hasChildNodes()) {
				messageDiv.removeChild(messageDiv.firstChild)
			}
			for (let i = 0; i < data['messages'].length; i++) {
				let messageContainer = document.createElement('div')
				if (data['messages'][i]['user'] === localStorage.getItem('user')) {
					messageContainer.setAttribute('class', 'message message-self')
				} else {
					messageContainer.setAttribute('class', 'message message-other')
				}
				let p = document.createElement('p')
				p.setAttribute('class', 'message-content')
				p.innerHTML = `<b>${data['messages'][i]['user']}:</b> `
				if (data['messages'][i]['message']['text']) {
					p.innerHTML += data['messages'][i]['message']['text']
				}
				messageContainer.appendChild(p)
				if (data['messages'][i]['message']['file']) {
					let l = document.createElement('a')
					l.setAttribute('href', data['messages'][i]['message']['file'])
					l.setAttribute('download', data['messages'][i]['message']['file'])
					l.innerHTML = data['messages'][i]['message']['file'].slice(7)
					messageContainer.appendChild(l)
				}
				let q = document.createElement('p')
				q.setAttribute('class', 'message-content timestamp')
				let timestamp = data['messages'][i]['timestamp']
				let time
				let messageTime = new Date(timestamp)
				let messageString = messageTime.toUTCString()
				let today = new Date()
				todayString = today.toUTCString()
				let hour = leftPadding(messageTime.getHours())
				let minutes = leftPadding(messageTime.getMinutes())
				//if the message was sent today
				if (messageString.slice(0, 12) === todayString.slice(0, 12)) {
					time = hour + ":" + minutes
				} else {
					//if the message was sent yesterday
					if (checkForYesterday(messageTime)) {
						time = "Yesterday, " + hour + ":" + minutes
					} else {
						//if the message was sent before yesterday
						let month = monthNames[messageTime.getMonth()]
						let date = messageTime.getDate()
						let year = messageTime.getFullYear()
						if (year === today.getFullYear()) {
							time = month + " " + date + ", " + hour + ":" + minutes
						} else {
							time = month + " " + date + ", " + year + ", " + hour + ":" + minutes 
						}
					}
				}
			q.innerHTML = time
			messageContainer.appendChild(q)
			document.getElementById("message-div").appendChild(messageContainer)
			}
		}
		scrollToBottom()
	})
	socket.on('users update', data => {
		if (!data['users'].includes(localStorage.getItem('user'))) {
			document.querySelector(".message-button").disabled = true
			document.getElementById("submit-error").innerHTML = "You must be logged in to submit a message"
		} else {
			document.querySelector(".message-button").disabled = false
			document.getElementById("submit-error").innerHTML = ""
		}
	})
	socket.on('channels update', data => {
		if (!Object.keys(data['channels']).includes(document.title)) {
			self.close()
		}
	})
	window.addEventListener('unload', function(event) {
		if (document.getElementById("submit-error").innerHTML.length === 0) {
			let closedChannel = document.title
			socket.emit('user closed channel', {'user': localStorage.getItem('user'), 'channel': closedChannel})
			let channels = JSON.parse(localStorage.getItem('channels'))
			let index
			for (let i = 0; i < channels.length; i++) {
				if (closedChannel === channels[i]) {
					index = i
				}
			}
			channels.splice(index, 1)
			localStorage.setItem('channels', JSON.stringify(channels))
		}
	})
})

function configureSendButton() {
	if (document.querySelector('#text').value.length > 0  || document.getElementById('file').files[0]) {
		document.querySelector("#message-button").disabled = false
	} else {
		document.querySelector("#message-button").disabled = true
	}
}

function afterSending() {
	document.querySelector("#message-button").disabled = true
	document.querySelector("#text").value = ''
	document.getElementById("text").focus()
}

function checkForYesterday(messageDate) {
	let today = new Date()
	setTime(today)
	setTime(messageDate)
	if (today.getTime() - messageDate.getTime() === 86400000) {
		return true
	} else {
		return false
	}
}

function setTime(date) {
	date.setUTCHours(0,0,0,0)
}

function leftPadding(num) {
	if (num < 10) {
		return ("0" + num)
	} 
	return num
}

function getDateAsString() {
	let timestamp = new Date()
	let offset = timestamp.getTimezoneOffset()
	timestamp = timestamp + offset
	timestamp = timestamp.slice(0, timestamp.length-3)
	return timestamp
}

function scrollToBottom() {
	let messageDiv = document.querySelector("#message-div")
	messageDiv.scrollTop = messageDiv.scrollHeight - messageDiv.clientHeight		
}