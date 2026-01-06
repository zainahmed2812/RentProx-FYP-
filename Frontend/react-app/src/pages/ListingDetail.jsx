import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { listings } from '../data/listings'

export default function ListingDetail(){
  const { id } = useParams()
  const nav = useNavigate()
  const listing = listings.find(l => String(l.id) === String(id))
  if(!listing) return (
    <div className="container" style={{padding:40}}>
      <h2>Listing not found</h2>
      <button onClick={()=>nav(-1)} className="btn-ghost">Go back</button>
    </div>
  )

  return (
    <div className="page detail">
      <header className="topbar">
        <div className="brand">RentProx</div>
        <nav>
          <button className="btn-link" onClick={()=>nav('/')}>Home</button>
        </nav>
      </header>

      <main className="container" style={{paddingTop:24}}>
        <button className="btn-ghost" onClick={()=>nav(-1)} style={{marginBottom:12}}>← Back</button>

        <div className="detail-grid">
          <div className="gallery">
            {listing.images && listing.images.map((src,idx)=> (
              <div key={idx} className="gallery-item" style={{backgroundImage:`url(${src})`}} />
            ))}
          </div>

          <div className="detail-info">
            <h1>{listing.title}</h1>
            <div className="price">PKR {listing.price.toLocaleString()} <span className="muted">/month</span></div>
            <div className="muted">{listing.city} • {listing.type}</div>

            <section style={{marginTop:16}}>
              <h4>Overview</h4>
              <p>{listing.description}</p>
            </section>

            <section style={{marginTop:12}}>
              <h4>Details</h4>
              <ul>
                <li>{listing.beds} beds</li>
                <li>{listing.baths} baths</li>
                <li>{listing.area} sqft</li>
              </ul>
            </section>

            <div style={{marginTop:20}}>
              <button className="btn-primary">Contact Owner</button>
            </div>
          </div>
        </div>
      </main>

      <footer className="site-footer">© 2026 RentProx</footer>
    </div>
  )
}
