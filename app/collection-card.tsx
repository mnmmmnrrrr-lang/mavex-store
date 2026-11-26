import Image from "next/image";
import Link from "next/link";

export default function CollectionCard({ name, image, href, buttonLabel = "EXPLORE COLLECTION" }: {
  name: string;
  image: string;
  href: string;
  buttonLabel?: string;
}) {
  return (
    <article className="collection-card">
      <Link href={href} className="collection-card-image" aria-label={name}>
        <Image src={image} alt={name} fill sizes="(max-width: 700px) 50vw, (max-width: 1100px) 33vw, 25vw" quality={90} />
      </Link>
      <h3>{name}</h3>
      <Link className="collection-card-button" href={href}>{buttonLabel}</Link>
    </article>
  );
}
