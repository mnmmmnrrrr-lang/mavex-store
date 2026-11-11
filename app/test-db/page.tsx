import { supabase } from "@/lib/supabase";
import { connection } from "next/server";

export default async function TestDatabase() {
  await connection();

  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, status")
    .limit(10);

  if (error) {
    return (
      <main style={{ padding: 30 }}>
        <h1>Database Connection Error</h1>
        <p>{error.message}</p>
      </main>
    );
  }

  return (
    <main style={{ padding: 30 }}>
      <h1>MAVEX Database Connected</h1>
      <p>Products found: {data.length}</p>

      {data.map((product) => (
        <div key={product.id}>
          {product.name} - {product.price} EGP
        </div>
      ))}
    </main>
  );
}