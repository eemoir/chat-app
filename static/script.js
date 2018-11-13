const windowAttributes = 'width=380,height=420,resizable,scrollbars=yes,status=1'

document.addEventListener('DOMContentLoaded', () => {
	let socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port)
	socket.on('connect', () => {
		if (localStorage.getItem('user') === null) {
			//if no user is currently logged in, create login form
			while (document.getElementById('form-div').hasChildNodes()) {
				document.getElementById('form-div').removeChild(document.getElementById('form-div').firstChild);
			}
			let form = document.createElement('form')
			form.setAttribute('id', 'username-form')
			form.setAttribute('action', '#')
			form.setAttribute('method', "GET")
			let p = document.createElement('p')
			p.innerHTML = "<b>You must sign in to create channels and chat with other users.</b>"
			form.appendChild(p)
			let p2 = document.createElement('p')
			p2.innerHTML = "Please enter your preferred username: "
			form.appendChild(p2)
			let i = document.createElement('input')
			i.setAttribute('id', 'username')
			i.setAttribute('type', 'text')
			form.appendChild(i)
			let b = document.createElement('button')
			b.setAttribute('id', 'submit-username')
			b.setAttribute('type', 'submit')
			b.innerHTML = "Submit"
			form.appendChild(b)
			document.getElementById('form-div').appendChild(form)
			//configure submitusername button
			document.querySelector('#submit-username').disabled = true;
			document.querySelector('#username').onkeyup = () => {
				if (document.querySelector('#username').value.length > 0) {
					document.querySelector("#submit-username").disabled = false;
				} else {
					document.querySelector("#submit-username").disabled = true;
				}
			}
			//disable all buttons relating to chat channels until user is logged in
			document.querySelectorAll('.button').forEach((button) => {
				button.disabled = true
			})
			//log in user
			document.querySelector('#username-form').onsubmit = () => {
				const user = document.querySelector("#username").value
				//check to see if that username is already online
				const request = new XMLHttpRequest()
				request.open("POST", "/")
				request.onload = () => {
					const data = JSON.parse(request.responseText)
					if (data.success) {
						//set local variables, get rid of error message if it exists
						localStorage.setItem('user', user)
						let channelArray = []
						localStorage.setItem('channels', JSON.stringify(channelArray))
						document.querySelector("#user-error").innerHTML = ''
						loginUser(socket)
					} else {
						document.querySelector("#user-error").innerHTML = "That user is already logged on. Please pick a different username"
					}
				}
				const data = new FormData();
        		data.append('user', user);
				request.send(data)
				return false
			}
		}	else {
			//if user was previously logged in, log them in and open any chat windows they were previously participating in
			loginUser(socket)
			let channels = JSON.parse(localStorage.getItem('channels'))
			if (channels.length > 0) {
				channels.forEach((channel) => {
					let channelURL = `/channel/${channel}`
					let channelWindow = `${channel}Window`
					window.open(channelURL, channelWindow, windowAttributes)
				})
			}
		}
		//creating a new channel
		document.querySelector("#channel-form").onsubmit = () => {
			channel = document.querySelector("#channel-name").value
			//check to see if that channel name is already taken
			const request = new XMLHttpRequest() 
			request.open("POST", "/check_channel")	
			request.onload = () => {
				const data = JSON.parse(request.responseText)
				//if it is not, get rid of any error messages, clear the name input, 
				//add the channel to the list on the server, and open the channel window
				if (data.success) {
					document.querySelector('#channel-error').innerHTML = ''
					document.querySelector("#channel-name").value = ''
					socket.emit('channel added', {'channel': channel, 'user': localStorage.getItem('user')})
					window.open(`channel/${channel}`, `${channel}Window`, windowAttributes)
				} else {
					document.querySelector("#channel-error").innerHTML = "That channel name is already taken. Please choose a different one."
				}
			}
			//reconfigure submit button
			document.querySelector("#create-channel").disabled = true
			const data = new FormData();
       		data.append('channel', channel);
			request.send(data)
			return false
		}
	})
	socket.on('users update', data => {
		let list = document.getElementById("users_list")
		while (list.hasChildNodes()) {
			list.removeChild(list.firstChild)
		}
		data.users.forEach((user) => {
			let li = document.createElement('li')
			li.innerHTML = user
			list.appendChild(li)
		})
	})
	socket.on("channels update", data => {
		displayChannelButtons(data)
	})
	window.addEventListener('unload', function(event) {
		socket.emit('user logged off', {'user': localStorage.getItem('user')})
	})
})

function displayChannelButtons(data) {
	let channels = document.getElementById("channels-div")
	while (channels.hasChildNodes()) {
		channels.removeChild(channels.firstChild)
	}
	if (Object.keys(data.channels).length === 0) {
		let p = document.createElement('p')
		p.innerHTML = "No channels currently active"
		channels.appendChild(p)
	} else {
		Object.keys(data.channels).forEach((channel) => {
			let d = document.createElement('div')
			let b = document.createElement('button')
			let onclick = `window.open("channel/${channel}", "${channel}Window", windowAttributes)`
			b.setAttribute('class', 'button channel-button')
			b.innerHTML = channel
			b.setAttribute('onclick', onclick)
			d.appendChild(b)
			let x = document.createElement('button')
			x.setAttribute('class', 'button delete-channel')
			x.setAttribute('onclick', `deleteChannel("${channel}")`)
			x.innerHTML = "X"
			d.appendChild(x)
			channels.appendChild(d)
		})
	}
}

function loginUser(socket) {
	//enable all channel buttons except for channel creation button
	document.querySelectorAll('.button').forEach((button) => {
		button.disabled = false
	})
	document.getElementById('create-channel').disabled = true
	let w = document.createElement('p')
	w.innerHTML = `Welcome, ${localStorage.getItem('user')}!`
	let form = document.getElementById('form-div')
	while (form.hasChildNodes()) {
		form.removeChild(form.firstChild);
	}
	form.appendChild(w)
	//add user to server-side list of users
	socket.emit('user logged in', {'user': localStorage.getItem('user')})
	//configure channel creation buttons
	document.querySelector('#channel-name').onkeyup = () => {
		if (document.querySelector('#channel-name').value.length > 0) {
			document.querySelector("#create-channel").disabled = false
		} else {
			document.querySelector("#create-channel").disabled = true
		}
	}
}

function deleteChannel(channel) {
	let socket = io.connect(location.protocol + '//' + document.domain + ':' + location.port)
	socket.emit('channel deleted', {'channel': channel})
}