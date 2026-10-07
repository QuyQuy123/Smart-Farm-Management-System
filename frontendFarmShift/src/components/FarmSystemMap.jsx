// src/components/FarmSystemMap.jsx
// Sơ đồ Hệ thống Quản lý Chăn nuôi FarmShift chuẩn DESIGN.md & FarmShift_MienBinh_Full.html
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Home, Warehouse, Repeat, Utensils, ClipboardCheck,
  HeartPulse, Thermometer, Box, Scale, Award,
  Truck, ShoppingCart, ArrowLeftRight, CheckCircle2,
  DollarSign, ArrowDownRight, ArrowUpRight, ArrowRight,
  Info, Sparkles, Layers, ShieldCheck, Zap
} from 'lucide-react';

export const FarmSystemMap = ({ onSelectNode }) => {
  const navigate = useNavigate();

  const handleNodeClick = (route) => {
    if (onSelectNode) {
      onSelectNode(route);
    } else {
      navigate(route);
    }
  };

  const bands = [
    {
      id: 'infrastructure',
      title: 'HẠ TẦNG NUÔI',
      icon: <Warehouse size={18} color="var(--color-primary)" />,
      description: 'Quy hoạch khu đất, cấu trúc chuồng trại và quản lý các lứa nuôi theo chu kỳ',
      nodes: [
        { id: 'areas', title: 'Khu nuôi', desc: 'Khu Mía Thịt, Khu J Thịt', count: '2 khu', route: '/areas', icon: <Home size={16} /> },
        { id: 'barns', title: 'Chuồng nuôi', desc: '5 chuồng đang nuôi', count: '5 chuồng', route: '/barns', icon: <Warehouse size={16} /> },
        { id: 'cycles', title: 'Lứa nuôi', desc: 'Theo dõi vòng đời đàn', count: '3 lứa', route: '/barns?tab=cycles', icon: <Repeat size={16} /> }
      ]
    },
    {
      id: 'diary',
      title: 'NHẬT KÝ CHĂN NUÔI',
      icon: <ClipboardCheck size={18} color="var(--color-primary)" />,
      description: 'Ghi nhận thực tế hàng ngày: lượng cám, công việc, sức khỏe và môi trường IoT',
      nodes: [
        { id: 'feed-diary', title: 'Ghi cám', desc: 'Lượng ăn theo cữ / ngày', count: '711 kg/ngày', route: '/journal?tab=feed', icon: <Utensils size={16} /> },
        { id: 'work-diary', title: 'Ghi công việc', desc: 'Vệ sinh, sát trùng, đảo trấu', count: '5 việc/ngày', route: '/journal?tab=work', icon: <ClipboardCheck size={16} /> },
        { id: 'health-diary', title: 'Theo dõi vật nuôi', desc: 'Cân mẫu & hao hụt', count: '2 con hao hụt', route: '/journal?tab=health', icon: <HeartPulse size={16} /> },
        { id: 'env-diary', title: 'Theo dõi môi trường', desc: 'Nhiệt ẩm IoT & điều khiển', count: '28.5°C | 72%', route: '/journal?tab=env', icon: <Thermometer size={16} /> }
      ]
    },
    {
      id: 'inventory',
      title: 'QUẢN LÝ TỒN KHO',
      icon: <Box size={18} color="var(--color-primary)" />,
      description: 'Kiểm soát hàng hóa, cám, vắc-xin, thuốc thú y, hóa chất và thành phẩm thu hoạch',
      nodes: [
        { id: 'catalog-warehouses', title: 'Danh mục kho', desc: 'Kho Cám, Kho Thuốc, Kho Giống', count: '5 kho', route: '/catalog-settings?tab=warehouses', icon: <Warehouse size={16} /> },
        { id: 'inventory-items', title: 'Hàng hóa & Thẻ kho', desc: 'Cám Higro, Enro, Lasota', count: '14 mặt hàng', route: '/inventory', icon: <Box size={16} /> },
        { id: 'catalog-units', title: 'Đơn vị tính & Quy cách', desc: 'Bao 25kg, Lọ, Liều, Chai', count: '8 đơn vị', route: '/catalog-settings?tab=units', icon: <Scale size={16} /> },
        { id: 'catalog-brands', title: 'Nhãn hiệu', desc: 'Dabaco, De Heus, Marphavet', count: '6 nhãn hiệu', route: '/catalog-settings?tab=brands', icon: <Award size={16} /> }
      ]
    },
    {
      id: 'invoices',
      title: 'HÓA ĐƠN & CHỨNG TỪ',
      icon: <ShoppingCart size={18} color="var(--color-primary)" />,
      description: 'Luân chuyển hàng hóa: nhập nguyên liệu, xuất nội bộ sang chuồng và xuất bán',
      nodes: [
        { id: 'purchases', title: 'Nhập hàng hóa', desc: 'Đơn nhập NCC An Phú, Dabaco', count: '4 đơn nhập', route: '/purchases', icon: <Truck size={16} /> },
        { id: 'transfers', title: 'Xuất nhập nội bộ', desc: 'Xuất cám sang Chuồng A1, A2', count: '5 phiếu', route: '/transfers', icon: <ArrowLeftRight size={16} /> },
        { id: 'harvest', title: 'Thu hoạch vật nuôi', desc: 'Cân gà xuất chuồng theo biểu', count: '2 phiếu cân', route: '/sales?tab=harvest', icon: <CheckCircle2 size={16} /> },
        { id: 'sales', title: 'Bán hàng từ kho', desc: 'Bán gà thịt cho thương lái', count: '2 đơn bán', route: '/sales', icon: <ShoppingCart size={16} /> }
      ]
    },
    {
      id: 'money',
      title: 'DÒNG TIỀN & SỔ QUỸ',
      icon: <DollarSign size={18} color="var(--color-primary)" />,
      description: 'Quản lý quỹ tiền mặt, ngân hàng, phiếu thu, phiếu chi, chuyển quỹ và tài sản',
      nodes: [
        { id: 'funds', title: 'Nguồn quỹ', desc: 'MB Bank, Tiền mặt, VCB', count: '282.1M đ', route: '/cashbook?tab=funds', icon: <DollarSign size={16} /> },
        { id: 'payments', title: 'Phiếu chi', desc: 'Chi tiền cám, điện nước, nhân công', count: 'PC000036', route: '/cashbook?type=Chi', icon: <ArrowUpRight size={16} /> },
        { id: 'receipts', title: 'Phiếu thu', desc: 'Thu tiền bán gà, thu nợ', count: 'PT000022', route: '/cashbook?type=Thu', icon: <ArrowDownRight size={16} /> },
        { id: 'fund-transfers', title: 'Chuyển quỹ nội bộ', desc: 'Rút tiền mặt, nộp tài khoản', count: '2 lệnh chuyển', route: '/cashbook?tab=transfers', icon: <ArrowLeftRight size={16} /> }
      ]
    }
  ];

  return (
    <div style={{ width: '100%', maxWidth: '1180px', margin: '0 auto' }}>
      {/* Header Banner */}
      <div style={{
        backgroundColor: 'var(--color-surface-soft)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--rounded-lg)',
        padding: '24px 32px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Sparkles size={16} /> Kiến trúc hệ thống chăn nuôi khép kín
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 500, color: 'var(--color-ink)', margin: '6px 0 4px', lineHeight: 1.2 }}>
            Sơ đồ Hệ thống Quản lý Chăn nuôi Trang trại Miền Bính
          </h2>
          <p style={{ margin: 0, color: 'var(--color-body)', fontSize: '14px', maxWidth: '720px' }}>
            Tổng quan luồng dữ liệu 5 phân hệ cốt lõi: từ hạ tầng nuôi, nhật ký hàng ngày, quản lý kho hàng, hóa đơn chứng từ đến dòng tiền sổ quỹ. Bấm vào bất kỳ thẻ nào để mở trực tiếp màn hình nghiệp vụ tương ứng.
          </p>
        </div>

        <div style={{
          backgroundColor: 'var(--color-canvas)',
          padding: '12px 18px',
          borderRadius: 'var(--rounded-md)',
          border: '1px solid var(--color-hairline)',
          fontSize: '13px',
          color: 'var(--color-ink)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Info size={16} color="var(--color-primary)" />
          <span><strong>Chế độ:</strong> Toàn quyền Quản lý trang trại</span>
        </div>
      </div>

      {/* 5 Architectural Bands */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {bands.map((band, bandIdx) => (
          <div
            key={band.id}
            style={{
              backgroundColor: 'var(--color-canvas)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--rounded-lg)',
              padding: '22px 26px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            {/* Band Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--color-hairline)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--rounded-md)',
                  backgroundColor: 'var(--color-surface-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {band.icon}
                </div>
                <div>
                  <h3 style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--color-ink)',
                    margin: 0,
                    letterSpacing: '0.03em'
                  }}>
                    {bandIdx + 1}. {band.title}
                  </h3>
                  <span style={{ fontSize: '12.5px', color: 'var(--color-muted)' }}>
                    {band.description}
                  </span>
                </div>
              </div>

              <span className="farmshift-badge farmshift-badge-neutral" style={{ fontSize: '11px' }}>
                {band.nodes.length} phân hệ
              </span>
            </div>

            {/* Nodes Row with arrows */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${band.nodes.length}, 1fr)`,
              gap: '14px',
              position: 'relative'
            }}>
              {band.nodes.map((node, nodeIdx) => (
                <div
                  key={node.id}
                  onClick={() => handleNodeClick(node.route)}
                  role="button"
                  tabIndex={0}
                  style={{
                    backgroundColor: 'var(--color-surface-soft)',
                    border: '1px solid var(--color-hairline)',
                    borderRadius: 'var(--rounded-md)',
                    padding: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '110px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-primary)';
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-hairline)';
                    e.currentTarget.style.backgroundColor = 'var(--color-surface-soft)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: 'var(--rounded-sm)',
                      backgroundColor: 'var(--color-canvas)',
                      border: '1px solid var(--color-hairline)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-ink)'
                    }}>
                      {node.icon}
                    </div>
                    <span style={{
                      fontSize: '11.5px',
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                      backgroundColor: 'rgba(0, 155, 139, 0.08)',
                      padding: '2px 8px',
                      borderRadius: 'var(--rounded-pill)'
                    }}>
                      {node.count}
                    </span>
                  </div>

                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--color-ink)', display: 'block', marginBottom: '3px' }}>
                      {node.title}
                    </strong>
                    <span style={{ fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.4, display: 'block' }}>
                      {node.desc}
                    </span>
                  </div>

                  <div style={{
                    marginTop: '10px',
                    paddingTop: '8px',
                    borderTop: '1px dashed var(--color-hairline)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '11.5px',
                    color: 'var(--color-link)',
                    fontWeight: 500
                  }}>
                    <span>Mở màn hình</span>
                    <ArrowRight size={13} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
