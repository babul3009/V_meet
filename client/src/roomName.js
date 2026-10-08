const A = ["mango","peachy","cosmic","fuzzy","sunny","minty","jolly","cozy","lucky","dizzy","velvet","golden","bubbly","snappy","breezy","sleepy","zesty","dreamy","witty","happy","glowy","spicy","clever","funky"];
const B = ["panda","otter","koala","falcon","tiger","llama","gecko","puffin","fox","dolphin","bunny","owl","penguin","hedgehog","lynx","sparrow","turtle","moose","badger","raccoon","yak","quokka","parrot","whale"];
const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const newRoom = () => `${pick(A)}-${pick(B)}-${10 + Math.floor(Math.random() * 90)}`;
