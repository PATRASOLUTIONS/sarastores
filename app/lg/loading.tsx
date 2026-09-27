export default function Loading() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-4">
                    <div className="absolute inset-0 border-4 border-red-200 border-t-red-600 rounded-full animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <img src="/lg.png" alt="LG" className="h-8 w-8 object-contain" />
                    </div>
                </div>
                <p className="text-gray-600 animate-pulse">Loading LG Products...</p>
            </div>
        </div>
    )
}
