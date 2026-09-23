<template>
  <div class="image-upload">
    <div class="custom-panel-title" v-i18n>Picture</div>
    <div class="custom-row">
      <input type="file" accept="image/png,image/jpeg,image/webp" @change="onFile" data-test="file">
      <AppButton v-if="modelValue !== undefined" title="Remove picture" size="small" @click="$emit('update:modelValue', undefined)" />
    </div>
    <img v-if="modelValue !== undefined" :src="modelValue" class="image-upload-preview" alt="" data-test="preview">
    <div class="custom-muted" v-i18n>PNG, JPEG or WebP. The picture is scaled to fit the card and stored with it (at most 400 KB).</div>
    <div v-if="error !== undefined" class="image-upload-error" data-test="error">{{ error }}</div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import AppButton from '@/client/components/common/AppButton.vue';
import {MAX_CUSTOM_IMAGE_BYTES} from '@/common/custom/CustomCardDefinition';
import {translateText} from '@/client/directives/i18n';

export const MAX_WIDTH = 320;
export const MAX_HEIGHT = 200;

/** Scales an image file to fit the card and returns it as a JPEG or PNG data URL. */
export async function resizeImage(file: File, maxWidth = MAX_WIDTH, maxHeight = MAX_HEIGHT): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That is not an image'));
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (context === null) {
    return dataUrl;
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const isPng = file.type === 'image/png';
  return isPng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
}

/** Lets the designer attach a picture to the card. */
export default defineComponent({
  name: 'ImageUpload',
  components: {AppButton},
  props: {
    modelValue: {
      type: String,
      required: false,
    },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      error: undefined as string | undefined,
    };
  },
  methods: {
    async onFile(event: Event) {
      this.error = undefined;
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file === undefined) {
        return;
      }
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        this.error = translateText('Use a PNG, JPEG or WebP picture.');
        return;
      }
      try {
        const dataUrl = await resizeImage(file);
        if (dataUrl.length > MAX_CUSTOM_IMAGE_BYTES) {
          this.error = translateText('The picture is too large even after scaling. Try a simpler one.');
          return;
        }
        this.$emit('update:modelValue', dataUrl);
      } catch (e) {
        this.error = String(e instanceof Error ? e.message : e);
      }
    },
  },
});
</script>

<style scoped>
.image-upload-preview {
  max-width: 200px;
  max-height: 120px;
  display: block;
  margin: 4px 0;
  border-radius: 4px;
}

.image-upload-error {
  color: #f88;
}
</style>
