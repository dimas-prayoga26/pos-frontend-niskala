import noImage from "../../../assets/no-image.svg";
import { backendBaseUrl } from "../../../shared/api/backendUrl";
import { formatCurrency } from "../../../shared/lib/format";

// Uploaded images are served by the backend; anything else is used as-is.
const getItemImage = (item) => {
  if (item.imagePath?.startsWith("/uploads/")) {
    return `${backendBaseUrl}${item.imagePath}`;
  }

  return item.imagePath || noImage;
};

const QuantityControls = ({ quantity, onDecrement, onIncrement, onQuantityChange }) => (
  <div className="flex items-center justify-between bg-[#1f1f1f] px-2 py-2 rounded-lg gap-2 min-w-[88px] sm:min-w-[130px] sm:px-4 sm:py-3 sm:gap-4">
    <button onClick={onDecrement} className="text-[#a79981] text-xl sm:text-2xl">
      &minus;
    </button>
    <input
      type="number"
      min="0"
      max="999"
      value={quantity}
      onChange={(event) => onQuantityChange(event.target.value)}
      onFocus={(event) => event.target.select()}
      className="h-8 w-10 rounded-md bg-[#262626] text-center text-sm font-semibold text-white outline-none [appearance:textfield] sm:w-12 sm:text-base [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
    <button onClick={onIncrement} className="text-[#a79981] text-xl sm:text-2xl">
      &#43;
    </button>
  </div>
);

const MenuItemCard = ({
  item,
  price,
  quantity,
  onIncrement,
  onDecrement,
  onQuantityChange,
}) => (
  <div className="flex min-h-[210px] flex-col justify-between rounded-lg bg-[#1a1a1a] p-3 hover:bg-[#2a2a2a] sm:min-h-[260px] sm:p-4">
    <div>
      <h1 className="text-sm font-semibold leading-tight text-[#f5f5f5] sm:text-lg">
        {item.name}
      </h1>
      <img
        src={getItemImage(item)}
        alt={item.name}
        onError={(event) => {
          event.currentTarget.src = noImage;
        }}
        className="mt-2 aspect-[4/3] w-full rounded-lg object-cover sm:mt-3 sm:aspect-[16/9]"
      />
    </div>
    <div className="mt-3 flex w-full flex-col gap-2 sm:mt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-base font-bold text-[#f5f5f5] sm:text-xl">{formatCurrency(price)}</p>
      <QuantityControls
        quantity={quantity}
        onDecrement={onDecrement}
        onIncrement={onIncrement}
        onQuantityChange={onQuantityChange}
      />
    </div>
  </div>
);

export default MenuItemCard;
