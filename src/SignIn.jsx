import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SignIn = () => {
  const initialFormObject = {
    login: '',
    password: '',
    serverAddress: ''
  }

  const navigate = useNavigate()

  const [formObject, setFormObject] = useState(initialFormObject)

  const handleFormObjectChange = (event) => {
    setFormObject((current) => {
      return {
        ...current,
        [event.target.name]: event.target.value
      }
    })
  }

  const handleFormButtonClick = () => {
    sessionStorage.setItem('login', formObject.login)
    sessionStorage.setItem('password', formObject.password)
    sessionStorage.setItem('serverAddress', formObject.serverAddress)

    navigate('/home')
  }

  return (
    <form method="post" onSubmit={handleFormButtonClick}>
      <div className="box">
        {/* TITLE */}
        <h1>WalkieFleet</h1>

        {/* LOGIN INPUT */}
        <input
          type="text"
          name="login"
          className="field"
          value={formObject.login}
          onChange={handleFormObjectChange}
        />

        {/* PASSWORD INPUT */}
        <input
          type="password"
          name="password"
          className="field"
          value={formObject.password}
          onChange={handleFormObjectChange}
        />

        {/* SERVER ADDRESS INPUT */}
        <input
          type="text"
          name="serverAddress"
          className="field"
          value={formObject.serverAddress}
          onChange={handleFormObjectChange}
        />

        {/* SIGN IN BUTTON */}
        <button className="btn" type="submit">
          Sign In
        </button>
      </div>
    </form>
  )
}

export default SignIn
