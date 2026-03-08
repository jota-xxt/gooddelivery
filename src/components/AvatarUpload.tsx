import { useState, useRef, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Camera, Loader2, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';

interface AvatarUploadProps {
  userId: string;
  currentUrl: string | null;
  initials: string;
  size?: string;
  onUploaded: (url: string) => void;
}

async function getCroppedImg(imageSrc: string, crop: Area): Promise<Blob> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const size = 256;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    image,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, size, size
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/jpeg', 0.9);
  });
}

const AvatarUpload = ({ userId, currentUrl, initials, size = 'h-20 w-20', onUploaded }: AvatarUploadProps) => {
  const [uploading, setUploading] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Selecione uma imagem válida');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    if (!imageSrc || !croppedArea) return;
    setUploading(true);

    try {
      const blob = await getCroppedImg(imageSrc, croppedArea);
      const path = `${userId}/avatar.jpg`;

      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);

      const url = `${publicUrl}?t=${Date.now()}`;
      await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', userId);

      onUploaded(url);
      setCropOpen(false);
      setImageSrc(null);
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao salvar foto');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="relative inline-block">
        <Avatar className={`${size} border-4 border-primary cursor-pointer`} onClick={() => inputRef.current?.click()}>
          <AvatarImage src={currentUrl ?? undefined} alt="Avatar" />
          <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <button
          onClick={() => inputRef.current?.click()}
          className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md border-2 border-background"
        >
          <Camera className="h-3.5 w-3.5" />
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFileSelect} />
      </div>

      <Dialog open={cropOpen} onOpenChange={(open) => { if (!uploading) { setCropOpen(open); if (!open) setImageSrc(null); } }}>
        <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-base">Ajustar foto</DialogTitle>
          </DialogHeader>

          <div className="relative w-full aspect-square bg-black">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          <div className="px-4 py-3 flex items-center gap-3">
            <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            <Slider
              value={[zoom]}
              min={1}
              max={3}
              step={0.05}
              onValueChange={([v]) => setZoom(v)}
              className="flex-1"
            />
          </div>

          <DialogFooter className="px-4 pb-4">
            <Button variant="outline" onClick={() => { setCropOpen(false); setImageSrc(null); }} disabled={uploading}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AvatarUpload;
