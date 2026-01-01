/* SYMBOL LIBRARY
   Add your icons here.
   Format: { id: 'unique_id', icon: 'EMOJI_OR_TEXT', label: 'Tooltip Name', category: 'group_name' }
*/

const SYMBOL_LIBRARY = [
    // --- TRANSPORTATION ---
    { id: 'bus_stop',   icon: '🚏', label: 'Bus Stop',    category: 'transport' },
    { id: 'bus_stn',    icon: '🚌', label: 'Bus Station', category: 'transport' },
    { id: 'taxi',       icon: '🚕', label: 'Taxi Stand',  category: 'transport' },
    { id: 'parking',    icon: '🅿️', label: 'Parking',     category: 'transport' },
    { id: 'fuel',       icon: '⛽', label: 'Fuel Station',category: 'transport' },
    { id: 'mechanic',   icon: '🔧', label: 'Repair Shop', category: 'transport' },

    // --- AMENITIES ---
    { id: 'hospital',   icon: '🏥', label: 'Hospital',    category: 'amenity' },
    { id: 'police',     icon: '👮', label: 'Police',      category: 'amenity' },
    { id: 'toilet',     icon: '🚽', label: 'Restroom',    category: 'amenity' },
    { id: 'food',       icon: '🍴', label: 'Food/Dhaba',  category: 'amenity' },
    { id: 'hotel',      icon: '🏨', label: 'Hotel',       category: 'amenity' },
    { id: 'atm',        icon: '🏧', label: 'ATM',         category: 'amenity' },

    // --- WARNINGS / ROADS ---
    { id: 'warning',    icon: '⚠️', label: 'Hazard',      category: 'warning' },
    { id: 'construct',  icon: '🚧', label: 'Road Work',   category: 'warning' },
    { id: 'hump',       icon: '🐫', label: 'Speed Breaker', category: 'warning' },
    { id: 'sharp_turn', icon: '⤵️', label: 'Sharp Turn',  category: 'warning' },

    // --- LANDMARKS ---
    { id: 'temple',     icon: '🛕', label: 'Temple',      category: 'landmark' },
    { id: 'mosque',     icon: '🕌', label: 'Mosque',      category: 'landmark' },
    { id: 'park',       icon: '🌳', label: 'Park',        category: 'landmark' },
    { id: 'water',      icon: '💧', label: 'Water Point', category: 'landmark' }
];

// Helper to get symbols by category if needed later
function getSymbolsByCategory(cat) {
    return SYMBOL_LIBRARY.filter(s => s.category === cat);
}
