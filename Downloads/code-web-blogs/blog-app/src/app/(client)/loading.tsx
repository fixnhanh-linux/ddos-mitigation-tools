export default function Loading() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-4">
        {/* Vòng tròn xoay */}
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent dark:border-blue-400 dark:border-t-transparent"></div>
        
        {/* Chữ hiển thị */}
        <p className="text-lg font-medium animate-pulse text-gray-600 dark:text-gray-300">
          Đang tải...
        </p>
      </div>
    </div>
  );
}
