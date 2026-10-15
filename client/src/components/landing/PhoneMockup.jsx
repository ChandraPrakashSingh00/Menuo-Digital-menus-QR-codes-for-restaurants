import { BookOpenText, House, Search, User } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

const PREVIEW_ITEMS = [
  { name: 'Margherita Pizza', price: '₹279', image: '/images/menu/margherita-pizza.webp', note: 'Fresh basil' },
  { name: 'Pasta Alfredo', price: '₹249', image: '/images/menu/pasta-alfredo.webp', note: 'Creamy parmesan' },
  { name: 'Veg Burger', price: '₹159', image: '/images/menu/veg-burger.webp', note: 'House sauce' },
]

/** Decorative hero visual: food photo, a phone showing the customer menu, and a QR card. */
export default function PhoneMockup() {
  return (
    <div className="relative mx-auto w-full max-w-xl py-6 sm:py-0 lg:max-w-none" aria-hidden>
      <div className="relative ml-auto aspect-[5/6] w-[88%] overflow-hidden rounded-[2rem] [mask-image:linear-gradient(to_right,transparent,black_22%)] sm:aspect-[6/5]">
        <img src="/images/hero-food.webp" alt="" className="size-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-t from-black/10 to-transparent" />
      </div>

      <div className="absolute top-1/2 left-[6%] w-[46%] max-w-[250px] min-w-[190px] -translate-y-1/2 rotate-[-4deg] sm:left-[14%]">
        <div className="rounded-[2.4rem] bg-night-900 p-2 shadow-[0_40px_80px_-20px_rgb(7_28_35/0.55)] ring-1 ring-white/10">
          <div className="relative overflow-hidden rounded-[1.9rem] bg-white">
            <div className="absolute top-2 left-1/2 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-night-900" />
            <div className="relative h-36">
              <img src="/images/restaurant-cover.webp" alt="" className="size-full object-cover" />
              <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-black/10" />
              <div className="absolute inset-x-4 bottom-6 text-white">
                <p className="text-lg leading-tight font-extrabold">
                  Good Food,
                  <br />
                  <span className="text-mint">Good Mood</span>
                </p>
                <p className="mt-1 text-[10px] text-white/75">The Food Villa · Open now</p>
              </div>
            </div>
            <div className="relative -mt-4 rounded-t-3xl bg-white px-3.5 pt-4 pb-2">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-bold text-ink">Popular Dishes</p>
                <p className="text-[10px] font-semibold text-primary-600">View all</p>
              </div>
              <div className="mt-2.5 space-y-2">
                {PREVIEW_ITEMS.map((item) => (
                  <div key={item.name} className="flex items-center gap-2.5 rounded-xl border border-line p-1.5">
                    <img src={item.image} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-bold text-ink">{item.name}</p>
                      <p className="truncate text-[9px] text-ink-muted">{item.note}</p>
                    </div>
                    <span className="pr-1 text-[11px] font-bold text-ink">{item.price}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-around border-t border-line pt-2 text-ink-muted">
                <House className="size-4 text-primary-600" />
                <BookOpenText className="size-4" />
                <Search className="size-4" />
                <User className="size-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute right-2 bottom-6 animate-float rounded-2xl bg-white p-3 shadow-lift ring-1 ring-line sm:right-6 sm:bottom-10">
        {/* Scannable: opens the live demo menu. */}
        <QRCodeSVG value={`${window.location.origin}/m/the-food-villa`} size={88} fgColor="#101828" marginSize={0} />
        <p className="mt-2 text-center text-[11px] font-bold text-ink">Scan for Menu</p>
      </div>
    </div>
  )
}
