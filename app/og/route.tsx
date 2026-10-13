import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const title = (params.get("title") || "Sara Electronics").slice(0, 160)
  const description = (params.get("description") || "Explore electronics, home appliances and mobiles at SARA.").slice(0, 240)
  const brand = (params.get("brand") || "Sara Electronics").slice(0, 80)
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0f172a",
          backgroundImage:
            "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px",
          }}
        >
          <div
            style={{
              fontSize: title.length > 65 ? "44px" : "60px",
              fontWeight: "bold",
              color: "#ffffff",
              textAlign: "center" as const,
              lineHeight: 1.2,
              marginBottom: "20px",
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: "26px",
              color: "#94a3b8",
              textAlign: "center" as const,
              marginBottom: "40px",
            }}
          >
            {description}
          </div>

          <div
            style={{
              display: "flex",
              gap: "30px",
              fontSize: "24px",
              color: "#60a5fa",
            }}
          >
            <span>{brand}</span>
          </div>

          <div
            style={{
              display: "flex",
              gap: "30px",
              fontSize: "24px",
              color: "#60a5fa",
              marginTop: "15px",
            }}
          >
            <span>Electronics &amp; Home Appliances</span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
