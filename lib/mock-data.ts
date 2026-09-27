export const products = [
  {
    id: "1",
    name: "Wireless Headphones",
    description: "Premium wireless headphones with noise cancellation technology.",
    price: 9749,
    image: "https://placehold.co/300x300/222222/FFFFFF?text=Wireless+Headphones",
    stock: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "2",
    name: "Smartphone",
    description: "Latest model smartphone with high-resolution camera and fast processor.",
    price: 52499,
    image: "https://placehold.co/300x300/333333/FFFFFF?text=Smartphone",
    stock: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "3",
    name: "Laptop",
    description: "Powerful laptop for work and gaming with long battery life.",
    price: 97499,
    image: "https://placehold.co/300x300/444444/FFFFFF?text=Laptop",
    stock: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "4",
    name: "Smartwatch",
    description: "Track your fitness and stay connected with this stylish smartwatch.",
    price: 14999,
    image: "https://placehold.co/300x300/555555/FFFFFF?text=Smartwatch",
    stock: 12,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "5",
    name: "Wireless Earbuds",
    description: "Compact wireless earbuds with crystal clear sound quality.",
    price: 6749,
    image: "https://placehold.co/300x300/666666/FFFFFF?text=Wireless+Earbuds",
    stock: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "6",
    name: "Digital Camera",
    description: "Professional-grade digital camera for stunning photography.",
    price: 63749,
    image: "https://placehold.co/300x300/777777/FFFFFF?text=Digital+Camera",
    stock: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export const orders = [
  {
    id: "1",
    userId: "user1",
    total: 24748,
    status: "PENDING",
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    items: [
      {
        id: "101",
        productId: "1",
        quantity: 1,
        price: 9749,
        product: products[0],
      },
      {
        id: "102",
        productId: "5",
        quantity: 2,
        price: 6749,
        product: products[4],
      },
    ],
  },
  {
    id: "2",
    userId: "user2",
    total: 52499,
    status: "PROCESSING",
    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    items: [
      {
        id: "103",
        productId: "2",
        quantity: 1,
        price: 52499,
        product: products[1],
      },
    ],
  },
  {
    id: "3",
    userId: "user1",
    total: 97499,
    status: "COMPLETED",
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
    updatedAt: new Date(Date.now() - 86400000 * 4).toISOString(), // 4 days ago
    items: [
      {
        id: "104",
        productId: "3",
        quantity: 1,
        price: 97499,
        product: products[2],
      },
    ],
  },
]

export const users = [
  {
    id: "user1",
    name: "John Doe",
    email: "john@example.com",
    role: "USER",
    createdAt: new Date(Date.now() - 86400000 * 120).toISOString(), // 120 days ago
    phone: "+1 (555) 123-4567",
    address: "123 Main St, Anytown, USA",
  },
  {
    id: "user2",
    name: "Jane Smith",
    email: "jane@example.com",
    role: "USER",
    createdAt: new Date(Date.now() - 86400000 * 90).toISOString(), // 90 days ago
    phone: "+1 (555) 987-6543",
    address: "456 Oak Ave, Somewhere, USA",
  },
  {
    id: "admin1",
    name: "Admin User",
    email: "admin@example.com",
    role: "ADMIN",
    createdAt: new Date(Date.now() - 86400000 * 365).toISOString(), // 1 year ago
    phone: "+1 (555) 555-5555",
    address: "789 Admin Blvd, Adminville, USA",
  },
  {
    id: "user3",
    name: "Robert Johnson",
    email: "robert@example.com",
    role: "USER",
    createdAt: new Date(Date.now() - 86400000 * 45).toISOString(), // 45 days ago
    phone: "+1 (555) 222-3333",
    address: "101 Pine St, Elsewhere, USA",
  },
  {
    id: "user4",
    name: "Emily Davis",
    email: "emily@example.com",
    role: "USER",
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), // 30 days ago
    phone: "+1 (555) 444-5555",
    address: "202 Maple Dr, Nowhere, USA",
  },
]
