import Navbar from "../navbar";

export default function AuctionPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <main className="p-8 max-w-3xl mx-auto">
        <section className="mb-12 bg-gray-900 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-yellow-400">Auctions</h2>
          {/* TODO: List auctions here */}
          <button className="px-4 py-2 rounded bg-yellow-500 text-black hover:bg-yellow-600 transition">
            Refresh Auctions
          </button>
        </section>
        <section className="bg-gray-900 rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-green-400">
            Create Auction
          </h2>
          {/* TODO: Auction creation form here */}
          <button className="px-4 py-2 rounded bg-green-500 text-black hover:bg-green-600 transition">
            Create Auction
          </button>
        </section>
      </main>
    </div>
  );
}
