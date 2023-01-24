import React, { Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Home from './Home'
import SignIn from './SignIn'

const routes = [
  {
    path: '/',
    element: <SignIn />
  },
  {
    path: '/home',
    element: <Home />
  }
]

export default function App() {
  return (
    <Suspense fallback={<div>Loading</div>}>
      <Routes>
        {routes.map((item, index) => (
          <Route key={index} path={item.path} element={item.element} />
        ))}
      </Routes>
    </Suspense>
  )
}