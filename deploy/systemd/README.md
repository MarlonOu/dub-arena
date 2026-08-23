# systemd timer：資料庫備份／匯出清理自動排程

Phase 7.7。取代原本文件裡建議的手動 `crontab -e` 做法，改成版本控制內的 unit 檔，
部署時直接複製安裝，不需要每台機器各自手動貼一次 crontab 內容。

兩組各兩個檔案：`*.service`（實際執行的動作，`Type=oneshot`）＋ `*.timer`（排程本身）。
`.service` 不需要（也不應該）自己 `systemctl enable`，只有 `.timer` 需要 enable，
由 `.timer` 到期時去啟動同名的 `.service`。

## 安裝步驟（首次部署，或這幾個檔案本身有更新時）

```bash
cd /root/dub-arena
sudo cp deploy/systemd/dub-arena-backup.service deploy/systemd/dub-arena-backup.timer \
        deploy/systemd/dub-arena-exports-cleanup.service deploy/systemd/dub-arena-exports-cleanup.timer \
        /etc/systemd/system/

# 部署前務必先確認 pnpm 實際路徑，跟 .service 檔裡假設的一致
# （systemd 執行環境的 PATH 不一定跟登入 shell 相同）：
which pnpm

sudo systemctl daemon-reload
sudo systemctl enable --now dub-arena-backup.timer
sudo systemctl enable --now dub-arena-exports-cleanup.timer
```

## 確認排程生效

```bash
systemctl list-timers | grep dub-arena
```

會看到兩個 timer 各自的下次觸發時間（`NEXT`）跟上次觸發時間（`LAST`）。

## 手動立即觸發一次（不用等排定時間，測試用）

```bash
sudo systemctl start dub-arena-backup.service
sudo systemctl start dub-arena-exports-cleanup.service
journalctl -u dub-arena-backup.service -n 50 --no-pager
journalctl -u dub-arena-exports-cleanup.service -n 50 --no-pager
```

## 若原本已用 crontab 設定過

先移除舊的 crontab 項目（`crontab -e` 刪掉對應那兩行），避免同一件事被排程兩次
（重複備份本身無害，只是浪費資源；重複清理也無害，但沒必要）。
