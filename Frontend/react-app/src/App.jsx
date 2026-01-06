import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Listings from './pages/Listings'
import ListingDetail from './pages/ListingDetail'

export default function App(){
  return (
    <Routes>
      <Route path="/" element={<Home/>} />
      <Route path="/listings" element={<Listings/>} />
      <Route path="/listings/:id" element={<ListingDetail/>} />
    </Routes>
  )
}
