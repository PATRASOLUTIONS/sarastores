import { NextResponse } from 'next/server'
import { getSoftwareProductById, updateSoftwareProduct, deleteSoftwareProduct } from '@/lib/software-service'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const product = await getSoftwareProductById(id)
    
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Software product not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      product: {
        ...product,
        _id: product._id.toString()
      }
    })
  } catch (error) {
    console.error('Error fetching software product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch software product' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const success = await updateSoftwareProduct(id, body)
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Software product not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating software product:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update software product' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const success = await deleteSoftwareProduct(id)
    
    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Software product not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting software product:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete software product' },
      { status: 500 }
    )
  }
}
