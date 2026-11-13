import { useEffect, useRef } from "react";
import $ from "jquery";
import installSelect2 from "select2";
import "select2/dist/css/select2.css";
import "./select2.css";

if (!$.fn.select2) installSelect2(window, $);

// A select2 of several picks, shown as tags inside the input: picking or
// removing one calls onChange with every picked id (strings).
// Options may be grouped: { text, children: [options] } is an <optgroup>.
export default function MultiSelect2({ options, value = [], onChange, placeholder, label }) {
  const select = useRef(null);
  const latest = useRef({ onChange });
  latest.current = { onChange };
  const optionsKey = useRef("");

  useEffect(() => {
    const element = $(select.current);
    element.select2({
      width: "100%",
      placeholder,
      multiple: true,
      closeOnSelect: false,
      dropdownParent: element.parent(),
      language: { noResults: () => "Pilihan tidak ditemukan", searching: () => "Mencari..." },
    });
    element.on("change.multi", () => latest.current.onChange((element.val() || []).map(String)));
    return () => {
      element.off(".multi");
      element.select2("destroy");
    };
  }, [placeholder]);

  // The options are rebuilt only when they change, so an open dropdown stays.
  useEffect(() => {
    const element = $(select.current);
    const nextKey = JSON.stringify(options);
    if (nextKey !== optionsKey.current) {
      optionsKey.current = nextKey;
      const optionOf = (option) => new Option(option.text, String(option.id));
      element.empty();
      options
        .filter((option) => option.children || String(option.id) !== "")
        .forEach((option) =>
          element.append(
            option.children
              ? $("<optgroup>").attr("label", option.text).append(option.children.map(optionOf))
              : optionOf(option)
          )
        );
    }
    element.val(value.map(String)).trigger("change.select2");
  }, [options, value]);

  return (
    <div className="shopping-select2 min-w-0">
      <select ref={select} multiple aria-label={label || placeholder} />
    </div>
  );
}
