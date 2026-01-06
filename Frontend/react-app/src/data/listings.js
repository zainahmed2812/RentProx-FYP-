// Mock listings data with lat/lng so geolocation can match nearest city without external API
export const listings = [
  {
    id: 1,
    title: 'Modern 3 Bedroom Apartment in Bahria Town',
    city: 'Rawalpindi',
    price: 85000,
    type: 'Apartment',
    beds: 3,
    baths: 2,
    area: 1800,
    lat: 33.4892,
    lng: 73.0996,
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1560448070-3b6a1c1d5a18?w=1200&auto=format&fit=crop&q=80'
    ],
    description: 'Bright modern 3 bedroom apartment located in Bahria Town with easy access to amenities. Recently renovated with open-plan living area and modern kitchen.'
  },
  {
    id: 2,
    title: 'Cozy Studio Apartment Near F-10',
    city: 'Islamabad',
    price: 45000,
    type: 'Apartment',
    beds: 1,
    baths: 1,
    area: 650,
    lat: 33.6946,
    lng: 73.0479,
    image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=1200&auto=format&fit=crop&q=80'
    ],
    description: 'Compact studio perfect for singles or couples. Close to public transport and shopping.'
  },
  {
    id: 3,
    title: 'Spacious House in DHA Phase 5',
    city: 'Lahore',
    price: 250000,
    type: 'House',
    beds: 5,
    baths: 4,
    area: 4000,
    lat: 31.4504,
    lng: 74.3050,
    image: 'https://images.unsplash.com/photo-1572120360610-d971b9b1d5a2?w=1200&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1572120360610-d971b9b1d5a2?w=1200&auto=format&fit=crop&q=80'
    ],
    description: 'Large family house with garden and garage in a secure neighborhood. Ideal for families.'
  },
  {
    id: 4,
    title: 'Luxury Penthouse in Clifton',
    city: 'Karachi',
    price: 450000,
    type: 'Apartment',
    beds: 4,
    baths: 4,
    area: 5000,
    lat: 24.8091,
    lng: 67.0680,
    image: 'https://images.unsplash.com/photo-1572120360610-9b0f6b3b1d6a?w=1200&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1572120360610-9b0f6b3b1d6a?w=1200&auto=format&fit=crop&q=80'
    ],
    description: 'Luxurious penthouse with sea views and high-end finishes. Excellent location in Clifton.'
  },
  {
    id: 5,
    title: 'Farmhouse with Pool in Bedian Road',
    city: 'Lahore',
    price: 800000,
    type: 'Villa',
    beds: 6,
    baths: 5,
    area: 10000,
    lat: 31.4785,
    lng: 74.4118,
    image: 'https://images.unsplash.com/photo-1560448204-1a8b8e0a5d8d?w=1200&auto=format&fit=crop&q=80',
    images: [
      'https://images.unsplash.com/photo-1560448204-1a8b8e0a5d8d?w=1200&auto=format&fit=crop&q=80'
    ],
    description: 'Expansive farmhouse with private pool and large grounds; ideal for events or large families.'
  }
]
