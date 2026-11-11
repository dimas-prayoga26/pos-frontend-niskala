import { useEffect, useRef, useState } from "react";
import $ from "jquery";
import installSelect2 from "select2";
import "select2/dist/css/select2.css";
import "./select2.css";
import { enqueueSnackbar } from "notistack";

if (!$.fn.select2) installSelect2(window, $);

// Options may be grouped: { text, children: [options] } is an <optgroup>.
const flatten = options => options.flatMap(option => option.children || [option]);

// The "nothing found" note: notFound(term) gives { message, action?, onAction? };
// the action button closes the dropdown and calls onAction.
const notFoundNote = (element, notFound) => {
  const term = String(element.data("select2")?.$dropdown?.find(".select2-search__field").val() || "").trim();
  const { message, action, onAction } = notFound(term);
  const $note = $('<div class="select2-not-found"></div>').append($("<span></span>").text(message));
  if (action && onAction) {
    $note.append(
      $('<button type="button" class="select2-not-found__action"></button>')
        .text(action)
        .on("click", event => {
          event.preventDefault();
          event.stopPropagation();
          element.select2("close");
          onAction(term);
        })
    );
  }
  return $note;
};

// maxResults: show only the first n matches of the search (long lists).
// notFound: see notFoundNote; only without onCreate.
export default function CreatableSelect2({ options, value, onSelect, onCreate, placeholder, disabled, label, maxResults, notFound }) {
  const select = useRef(null);
  const latest = useRef({ options, onSelect, onCreate, notFound });
  latest.current = { options, onSelect, onCreate, notFound };
  const [saving, setSaving] = useState(false);
  const canCreate = typeof onCreate === "function";
  useEffect(() => {
    const element = $(select.current);
    let mounted = true;
    const noResults = () => {
      if (canCreate) return "Ketik nama untuk menambah data";
      const { notFound: currentNotFound } = latest.current;
      return currentNotFound ? notFoundNote(element, currentNotFound) : "Pilihan tidak ditemukan";
    };
    element.select2({
      width: "100%", placeholder, tags: canCreate, allowClear: canCreate,
      dropdownParent: element.parent(),
      language: { noResults, searching: () => "Mencari..." },
      createTag: ({ term }) => {
        const name = term.trim().replace(/\s+/g, " ");
        if (!name || name.length > 150 || flatten(latest.current.options).some(option => option.text.toLowerCase() === name.toLowerCase())) return null;
        return { id: `new:${name}`, text: name, newTag: true };
      },
      templateResult: data => data.newTag ? `Buat "${data.text}"` : data.text,
      ...(maxResults > 0 && { sorter: results => results.slice(0, maxResults) }),
    });
    element.on("select2:select.shopping", async event => {
      const option = event.params.data;
      if (!option.newTag) {
        latest.current.onSelect(flatten(latest.current.options).find(item => String(item.id) === option.id) || option);
        return;
      }
      setSaving(true);
      element.prop("disabled", true);
      try {
        const created = await latest.current.onCreate(option.text);
        if (!mounted) return;
        if (!Array.from(element[0].options).some(item => item.value === String(created.id))) {
          element.append(new Option(created.text, String(created.id), true, true));
        }
        element.val(String(created.id)).trigger("change.select2");
        latest.current.onSelect(created);
      } catch (error) {
        if (mounted) {
          element.val("").trigger("change.select2");
          latest.current.onSelect(null);
          enqueueSnackbar(error?.response?.data?.message || "Gagal menambahkan pilihan baru.", { variant: "error" });
        }
      } finally { if (mounted) setSaving(false); }
    });
    element.on("select2:clear.shopping", () => latest.current.onSelect(null));
    return () => { mounted = false; element.off(".shopping"); element.select2("destroy"); };
  }, [placeholder, canCreate, maxResults]);
  useEffect(() => {
    const element = $(select.current);
    const emptyOption = flatten(options).find(option => String(option.id) === "");
    const optionOf = option => new Option(option.text, String(option.id));
    element.empty().append(new Option(emptyOption?.text || "", ""));
    options
      .filter(option => option.children || String(option.id) !== "")
      .forEach(option => element.append(option.children
        ? $("<optgroup>").attr("label", option.text).append(option.children.map(optionOf))
        : optionOf(option)));
    element.val(value ? String(value) : "").trigger("change.select2");
  }, [options, value]);
  useEffect(() => { $(select.current).prop("disabled", Boolean(disabled || saving)); }, [disabled, saving]);
  return <div className="shopping-select2 min-w-0">
    <select ref={select} aria-label={label || placeholder} />
    {saving && <span className="mt-1 block text-xs text-[#d6c7ae]">Menyiapkan pilihan baru...</span>}
  </div>;
}
