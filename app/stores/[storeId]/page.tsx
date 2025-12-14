import StoreDetailClient from "./store-detail-client";

type PageProps = {
  params: Promise<{ storeId: string }>;
};

export default async function StorePage({ params }: PageProps) {
  const { storeId } = await params;
  return <StoreDetailClient storeId={storeId} />;
}
