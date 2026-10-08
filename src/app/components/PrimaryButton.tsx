import type { ButtonHTMLAttributes } from "react";

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className="rounded-md bg-indigo-700 px-4 py-2 font-medium text-white hover:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-400"
    />
  );
}
