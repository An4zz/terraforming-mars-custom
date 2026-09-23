<template>
  <div class="custom-card-art">
    <img :src="image" alt="" draggable="false">
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

/** The picture on a workshop card. */
export default defineComponent({
  name: 'CustomCardArt',
  props: {
    image: {
      type: String,
      required: true,
    },
  },
});
</script>

<style scoped>
.custom-card-art {
  margin: 2px 6px 0;
  text-align: center;
}

.custom-card-art img {
  max-width: 100%;
  max-height: 72px;
  border-radius: 4px;
  object-fit: cover;
}
</style>
