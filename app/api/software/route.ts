import { NextResponse } from 'next/server'
import { getAllSoftwareProducts, createSoftwareProduct } from '@/lib/software-service'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    
    const filter: any = {}
    if (status) {
      filter.status = status
    }
    
    const products = await getAllSoftwareProducts(filter)
    
    return NextResponse.json({
      success: true,
      products: products.map(p => ({
        ...p,
        _id: p._id.toString()
      }))
    })
  } catch (error) {
    console.error('Error fetching software products:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch software products' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate required fields
    if (!body.name || !body.description || !body.category) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const product = await createSoftwareProduct(body)
    
    return NextResponse.json({
      success: true,
      product: {
        ...product,
        _id: product._id.toString()
      }
    })
  } catch (error) {
    console.error('Error creating software product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create software product' },
      { status: 500 }
    )
  }
}
