// Formatting utility functions
export const formatNumber = (num) =>
  parseFloat(num).toLocaleString('en-US', { maximumFractionDigits: 0 });

export const formatAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '';

export const getTimeSince = (date) => {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds >= 86400) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ago`;
  return 'Just now';
};

export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};
