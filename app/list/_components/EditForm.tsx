"use client";

import React, { useState } from "react";
// Removed unused Firestore imports
import { PhotoType } from "../../helpers/models";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { useCounters } from "../../context/CountersContext";
import readExif from "../../helpers/exif";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";

interface EditFormProps {
  photo: PhotoType & { id?: string };
  onSave: (updates: PhotoType) => Promise<void> | void;
}

export function EditForm({ photo, onSave }: EditFormProps) {
  const [formData, setFormData] = useState({
    headline: photo.headline || "",
    tags: photo.tags || [],
    email: photo.email || "",
    date: photo.date || "",
    model: photo.model || "",
    lens: photo.lens || "",
    focal_length: photo.focal_length || 0,
    aperture: photo.aperture || 0,
    shutter: photo.shutter || "",
    iso: photo.iso || 0,
    flash: !!photo.flash,
    loc: photo.loc || "",
  });
  const [saving, setSaving] = useState(false);
  const [readingExif, setReadingExif] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData as PhotoType);
    } catch (error) {
      toast.error("Error saving photo", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (
    field: keyof typeof formData,
    value: string | string[] | number | boolean,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleReadExif = async () => {
    setReadingExif(true);
    try {
      // Fetch the image from the URL
      const response = await fetch(photo.url);
      const blob = await response.blob();

      // Read EXIF data from the blob
      const exifData = await readExif(blob);

      if (exifData) {
        // Update form data with EXIF data
        setFormData((prev) => ({
          ...prev,
          date: exifData.date || prev.date,
          model: exifData.model || prev.model,
          lens: exifData.lens || prev.lens,
          focal_length: exifData.focal_length || prev.focal_length,
          aperture: exifData.aperture || prev.aperture,
          shutter: exifData.shutter || prev.shutter,
          iso: exifData.iso || prev.iso,
          flash: exifData.flash !== undefined ? exifData.flash : prev.flash,
          loc: exifData.loc || prev.loc,
        }));
      }
    } catch (error) {
      toast.error("Error reading EXIF data", {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setReadingExif(false);
    }
  };

  const { values } = useCounters();

  const tagOptions = React.useMemo(() => {
    const existingTags = new Set([
      ...(photo.tags || []),
      ...Object.keys(values.values.tags),
      "family",
      "travel",
      "nature",
      "portrait",
    ]);
    return Array.from(existingTags).map((t) => ({ value: t, label: t }));
  }, [photo.tags, values.values.tags]);

  const modelOptions = React.useMemo(() => {
    return Object.keys(values.values.model).map((m) => ({
      value: m,
      label: m,
    }));
  }, [values.values.model]);

  const lensOptions = React.useMemo(() => {
    return Object.keys(values.values.lens).map((l) => ({ value: l, label: l }));
  }, [values.values.lens]);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {/* Photo Info Section */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
            Photo Info
          </h3>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Headline</label>
            <Input
              placeholder="Headline"
              value={formData.headline}
              onChange={(e) => handleChange("headline", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Filename</label>
            <Input value={photo.filename} readOnly disabled />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Tags</label>
            <Combobox
              value={formData.tags || []}
              onValueChange={(val) => handleChange("tags", val)}
              multiple
            >
              <ComboboxChips>
                {(formData.tags || []).map((tag) => (
                  <ComboboxChip key={tag}>{tag}</ComboboxChip>
                ))}
                <ComboboxChipsInput placeholder="Tags" />
              </ComboboxChips>
              <ComboboxContent>
                <ComboboxList>
                  <ComboboxEmpty>No tags found.</ComboboxEmpty>
                  {tagOptions.map((opt) => (
                    <ComboboxItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">
              Location [latitude, longitude]
            </label>
            <Input
              placeholder="Location"
              value={formData.loc}
              onChange={(e) => handleChange("loc", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              placeholder="Email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
            />
          </div>
        </div>

        {/* EXIF Data Section */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">
            EXIF Data
          </h3>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Date & Time</label>
            <Input
              type="datetime-local"
              value={formData.date ? formData.date.replace(" ", "T") : ""}
              onChange={(e) =>
                handleChange("date", e.target.value.replace("T", " "))
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Model</label>
            <Combobox
              value={formData.model}
              onValueChange={(val) => handleChange("model", val || "")}
            >
              <ComboboxInput placeholder="Select Camera Model" />
              <ComboboxContent>
                <ComboboxList>
                  <ComboboxEmpty>No model found.</ComboboxEmpty>
                  {modelOptions.map((opt) => (
                    <ComboboxItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Lens</label>
            <Combobox
              value={formData.lens}
              onValueChange={(val) => handleChange("lens", val || "")}
            >
              <ComboboxInput placeholder="Select Lens" />
              <ComboboxContent>
                <ComboboxList>
                  <ComboboxEmpty>No lens found.</ComboboxEmpty>
                  {lensOptions.map((opt) => (
                    <ComboboxItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Aperture (f/)</label>
              <Input
                type="number"
                step="0.1"
                value={formData.aperture}
                onChange={(e) =>
                  handleChange("aperture", parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">ISO</label>
              <Input
                type="number"
                value={formData.iso}
                onChange={(e) =>
                  handleChange("iso", parseInt(e.target.value) || 0)
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Focal Length (mm)</label>
              <Input
                type="number"
                value={formData.focal_length}
                onChange={(e) =>
                  handleChange("focal_length", parseInt(e.target.value) || 0)
                }
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Shutter</label>
              <Input
                placeholder="1/100"
                value={formData.shutter}
                onChange={(e) => handleChange("shutter", e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="flash"
              checked={formData.flash}
              onCheckedChange={(checked) => handleChange("flash", !!checked)}
            />
            <label
              htmlFor="flash"
              className="text-sm font-medium cursor-pointer leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Flash Fired
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-between gap-2 pt-2 border-t border-border">
        <Button
          type="button"
          onClick={handleReadExif}
          disabled={readingExif}
          variant="outline"
          className="h-11 text-base font-semibold"
        >
          {readingExif ? "Reading EXIF..." : "Read EXIF"}
        </Button>
        <Button
          type="submit"
          disabled={saving}
          className="h-11 text-base font-semibold"
        >
          {saving ? "Saving..." : photo.id ? "Save Changes" : "Publish Photo"}
        </Button>
      </div>
    </form>
  );
}
