import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listings } from '../data/listings'
import { haversineDistance } from '../utils/geo'

export default function Home(){
  const nav = useNavigate()
  const [location, setLocation] = useState('')
  const [locating, setLocating] = useState(false)

  const locateMe = () => {
    if(!navigator.geolocation) return alert('Geolocation not supported')
    setLocating(true)
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords
      // find nearest mock listing city
      let nearest = null
      let minD = Infinity
      listings.forEach(l => {
        const d = haversineDistance(lat, lng, l.lat, l.lng)
        if(d < minD){ minD = d; nearest = l }
      })
      if(nearest){
        setLocation(`${nearest.city} (approx.)`)
        // navigate to listings and pass lat/lng to filter nearby
        nav(`/listings?lat=${lat}&lng=${lng}`)
      } else {
        setLocation('Current Location')
        nav(`/listings?lat=${lat}&lng=${lng}`)
      }
      setLocating(false)
    }, err => {
      setLocating(false)
      alert('Unable to get location: ' + err.message)
    }, { enableHighAccuracy: true, timeout: 10000 })
  }

  const viewAll = () => {
    nav('/listings')
  }

  const openDetail = (id) => nav(`/listings/${id}`)

  // Featured properties (show first 6 or fewer)
  const featured = listings.slice(0, 6)

  return (
    <div className="page home">
      <header className="topbar">
        <div className="brand">RentProx</div>
        <nav>
          <button className="btn-link" onClick={()=>nav('/')}>Home</button>
          <button className="btn-primary" onClick={()=>nav('/listings')}>Browse Listings</button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <h1>Find Your Perfect <span className="accent">Rental Property</span></h1>
          <p>Discover thousands of rental properties in your area.</p>

          <div className="search-card">
            <input placeholder="Enter city or area" value={location} onChange={e=>setLocation(e.target.value)} />
            <div className="actions">
              <button onClick={locateMe} className="btn-ghost">{locating? 'Locating...' : 'Locate me'}</button>
              <button onClick={viewAll} className="btn-primary">View All Properties</button>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties section */}
      <section className="featured-section container">
        <div className="section-head" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div>
            <h2>Featured Properties</h2>
            <div className="muted">Handpicked properties for you</div>
          </div>
          <div>
            <button className="btn-ghost" onClick={viewAll}>View All Properties</button>
          </div>
        </div>

        <div className="featured-grid">
          {featured.map(p => (
            <div
              className="prop-card clickable"
              key={p.id}
              role="button"
              tabIndex={0}
              onClick={() => openDetail(p.id)}
              onKeyDown={(e)=>{ if(e.key === 'Enter') openDetail(p.id) }}
              aria-label={`Open ${p.title}`}
            >
              <div className="prop-thumb">
                <img src={p.images && p.images[0] ? p.images[0] : p.image} alt={p.title} onError={(e)=>{ e.currentTarget.src = 'https://via.placeholder.com/800x600?text=No+Image' }} />
                <div className="badge">Featured</div>
              </div>
              <div className="prop-body">
                <div className="price">PKR {p.price.toLocaleString()} <span className="muted">/month</span></div>
                <div className="prop-title">{p.title}</div>
                <div className="prop-location muted">{p.city}</div>
                <div className="prop-stats muted">{p.beds} Beds • {p.baths} Baths • {p.area} sqft</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why choose section moved below featured */}
      <section className="why-section container">
        <h2 style={{textAlign:'center',marginBottom:12}}>Why Choose RentProx?</h2>
        <p className="muted" style={{textAlign:'center',maxWidth:800, margin:'0 auto 20px'}}>We provide the best rental experience with our verified listings and seamless process.</p>
        <div className="why-cards">
          <div className="why-card">
            <div className="why-icon">🔒</div>
            <h4>Verified Listings</h4>
            <p className="muted">All properties are verified by our team to ensure authenticity and quality.</p>
          </div>
          <div className="why-card">
            <div className="why-icon">⚡</div>
            <h4>Quick Process</h4>
            <p className="muted">Find and book your perfect rental in minutes with our streamlined process.</p>
          </div>
          <div className="why-card">
            <div className="why-icon">👥</div>
            <h4>Tenant Screening</h4>
            <p className="muted">Advanced screening tools to help landlords find reliable tenants.</p>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="cards">
          <div className="card small">Verified Listings</div>
          <div className="card small">Quick Process</div>
          <div className="card small">Tenant Screening</div>
        </div>
      </section>

      <footer className="site-footer">
        <div>© 2026 RentProx</div>
      </footer>
    </div>
  )
}
