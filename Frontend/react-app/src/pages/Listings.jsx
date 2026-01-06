import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { listings as allListings } from '../data/listings'
import { haversineDistance } from '../utils/geo'

export default function Listings(){
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [listings, setListings] = useState(allListings)
  const [filterType, setFilterType] = useState('')
  const [nearbyInfo, setNearbyInfo] = useState(null)

  useEffect(()=>{
    const lat = parseFloat(params.get('lat'))
    const lng = parseFloat(params.get('lng'))
    if(!isNaN(lat) && !isNaN(lng)){
      // compute distance to each listing and sort
      const withDist = allListings.map(l => ({...l, distance: haversineDistance(lat,lng,l.lat,l.lng)}))
      const nearby = withDist.filter(l => l.distance <= 50).sort((a,b)=>a.distance-b.distance)
      setListings(nearby.length ? nearby : withDist.sort((a,b)=>a.distance-b.distance))
      setNearbyInfo({lat,lng})
    } else {
      setListings(allListings)
      setNearbyInfo(null)
    }
  }, [params])

  useEffect(()=>{
    if(filterType) setListings(allListings.filter(l=>l.type===filterType))
    else setListings(allListings)
  },[filterType])

  const openDetail = (id) => {
    nav(`/listings/${id}`)
  }

  return (
    <div className="page listings slide-in">
      <header className="topbar">
        <div className="brand">RentProx</div>
        <nav>
          <button className="btn-link" onClick={()=>nav('/')}>Home</button>
        </nav>
      </header>

      <main className="container">
        <h2>Browse Properties</h2>
        {nearbyInfo && <div className="muted">Showing results near your location</div>}

        <div className="content">
          <aside className="sidebar">
            <h4>Filters</h4>
            <label>
              <select value={filterType} onChange={e=>setFilterType(e.target.value)}>
                <option value="">All Types</option>
                <option>Apartment</option>
                <option>House</option>
                <option>Villa</option>
              </select>
            </label>
          </aside>

          <section className="grid">
            {listings.map(l=> (
              <article key={l.id} className="card clickable" onClick={() => openDetail(l.id)} tabIndex={0} onKeyDown={(e)=>{ if(e.key==='Enter') openDetail(l.id)}}>
                <div className="thumb" style={{backgroundImage:`url(${l.image})`}} />
                <div className="card-body">
                  <div className="meta">{l.type}</div>
                  <h3>PKR {l.price.toLocaleString()}</h3>
                  <p className="title">{l.title}</p>
                  <div className="info">{l.beds} Beds • {l.baths} Baths • {l.area} sqft</div>
                  {l.distance !== undefined && <div className="muted">{l.distance.toFixed(1)} km away</div>}
                </div>
              </article>
            ))}
          </section>
        </div>

      </main>

      <footer className="site-footer">© 2026 RentProx</footer>
    </div>
  )
}
