import React from "react";
import { Star } from "lucide-react";

export const LandingTestimonials: React.FC = () => {
  const testimonials = [
    {
      quote:
        "We used to track customer credit in a physical ledger book that often got misplaced. With KOSHA's counter QR checkout, customers agree on repayment dates digitally, and our on-time collection rate jumped to 95%.",
      author: "Rajesh Kumar",
      title: "Proprietor, Sri Lakshmi Provisions",
      location: "Bengaluru, Karnataka",
      avatar: "/images/checkout-counter.jpg",
      rating: 5,
      type: "Retail Merchant",
    },
    {
      quote:
        "The 90-day cash runway simulation warned us 24 days in advance of a ₹1.8 Lakh shortfall due to delayed client payments. We discounted two invoices and paid our factory payroll without taking an emergency high-interest loan.",
      author: "Vikram Rao",
      title: "Managing Director, Apex Precision Engineering",
      location: "Peenya Industrial Area, Bengaluru",
      avatar: "/images/merchant-owner.jpg",
      rating: 5,
      type: "MSME Manufacturer",
    },
    {
      quote:
        "I love being able to buy groceries at my local shop and split the payment. I paid ₹500 immediately via UPI and agreed to clear the balance on salary day. No awkward bargaining, just a clean receipt on my phone.",
      author: "Rahul Sharma",
      title: "Verified Customer & Community Member",
      location: "Indiranagar, Bengaluru",
      avatar: "/images/customer-phone.jpg",
      rating: 5,
      type: "Customer Member",
    },
  ];

  return (
    <section className="py-16 sm:py-24 bg-white border-b border-slate-200/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <p className="text-xs uppercase tracking-wider font-bold text-kosha-blue">
            Real Stories, Real Resilience
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-kosha-navy mt-2 tracking-tight">
            Loved by merchants and customers alike.
          </h2>
          <p className="text-slate-600 text-base sm:text-lg mt-3">
            See how small businesses across Karnataka are taking control of their cash runway and customer credit.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="bg-slate-50/80 rounded-3xl p-7 border border-slate-200/80 hover:border-slate-300 transition-all flex flex-col justify-between shadow-xs hover:shadow-md"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 text-amber-400">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-[11px] font-bold text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                    {t.type}
                  </span>
                </div>

                <p className="text-slate-700 text-sm sm:text-base leading-relaxed italic">
                  "{t.quote}"
                </p>
              </div>

              <div className="pt-6 border-t border-slate-200/60 mt-6 flex items-center gap-3">
                <img
                  src={t.avatar}
                  alt={t.author}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-xs shrink-0"
                />
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{t.author}</h4>
                  <p className="text-xs text-slate-600 font-medium">{t.title}</p>
                  <p className="text-[11px] text-slate-400">{t.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
