import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
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
              fontSize: "72px",
              fontWeight: "bold",
              color: "#ffffff",
              textAlign: "center" as const,
              lineHeight: 1.2,
              marginBottom: "20px",
            }}
          >
            Sara Electronics
          </div>

          <div
            style={{
              fontSize: "32px",
              color: "#94a3b8",
              textAlign: "center" as const,
              marginBottom: "40px",
            }}
          >
            Shop Smart, Live Better
          </div>

          <div
            style={{
              display: "flex",
              gap: "30px",
              fontSize: "24px",
              color: "#60a5fa",
            }}
          >
            <span>Televisions</span>
            <span>|</span>
            <span>Refrigerators</span>
            <span>|</span>
            <span>Washing Machines</span>
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
            <span>Air Conditioners</span>
            <span>|</span>
            <span>Smartphones</span>
            <span>|</span>
            <span>Home Appliances</span>
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
