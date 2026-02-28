import { formatEther } from "@/lib/utils";
import { ZERO_ADDRESS } from "@/lib/constants";

export function TokenAmount({
  amount,
  token,
}: {
  amount: bigint;
  token: string;
}) {
  const symbol = token === ZERO_ADDRESS ? "ETH" : "Token";
  return (
    <span className="font-mono text-[#D9AA90]">
      {formatEther(amount)} {symbol}
    </span>
  );
}
